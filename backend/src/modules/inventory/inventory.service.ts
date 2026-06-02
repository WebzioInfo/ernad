import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { 
  inventoryStock, 
  inventoryTransactions, 

  warehouseLocations, 
  packagingConfigurations,
  rawMaterials,
  rawMaterialTransactions,
  productStockTransactions,
  productionStock,
  products,
  productionLogs,
  dispatchLogs,
  productionBatches,
  users,
  salesTransactions
} from '../../database/schema';

import { eq, sql, desc, ilike, and, isNull, gte } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { ProductionEventsService } from '../../realtime/production.gateway';
import { sumRawMaterialTransactions } from './raw-material-balance.util';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly eventsService: ProductionEventsService,
  ) {}

  async getInventory() {
    return await db.select({
      id: inventoryStock.id,
      itemName: inventoryStock.itemName,
      sku: inventoryStock.sku,
      unit: inventoryStock.unit,
      quantity: inventoryStock.quantity,
      minimumStock: inventoryStock.minimumStock,
      materialType: inventoryStock.materialType,
      warehouseName: warehouseLocations.name,
    })
    .from(inventoryStock)
    .leftJoin(warehouseLocations, eq(inventoryStock.warehouseId, warehouseLocations.id))
    .orderBy(inventoryStock.itemName);
  }

  async getStockByCategory(materialType: string) {
    return await db.select({
      id: inventoryStock.id,
      itemName: inventoryStock.itemName,
      sku: inventoryStock.sku,
      unit: inventoryStock.unit,
      quantity: inventoryStock.quantity,
      materialType: inventoryStock.materialType,
    })
    .from(inventoryStock)
    .where(ilike(inventoryStock.materialType, materialType));
  }

  async getMaterialLedger(stockId: string) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!stockId || !UUID_REGEX.test(stockId)) {
      return [];
    }
    return await db.select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.stockId, stockId))
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(100);
  }

  async getPackagingConfigs(productId: string) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!productId || !UUID_REGEX.test(productId)) {
      return [];
    }
    return await db.select()
      .from(packagingConfigurations)
      .where(eq(packagingConfigurations.productId, productId));
  }

  async getWarehouses() {
    return await db.select().from(warehouseLocations);
  }


  async updateStock(dto: { 
    stockId: string; 
    quantity: number; 
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'CONSUMPTION' | 'REJECTION' | 'WASTAGE' | 'TRANSFER' | 'RETURN'; 
    remarks?: string; 
    referenceId?: string; // e.g., Telemetry Log ID or Batch ID
    performedBy?: string;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Lock stock row for atomic update
      const [stock] = await tx.select().from(inventoryStock)
        .where(eq(inventoryStock.id, dto.stockId))
        .for('update');
      
      if (!stock) throw new Error(`Stock item ${dto.stockId} not found`);

      const currentQty = Number(stock.quantity);
      let newQty = currentQty;

      // 2. Calculate new quantity based on type
      const isDeduction = ['OUT', 'CONSUMPTION', 'REJECTION', 'WASTAGE'].includes(dto.type);
      const isInflow = ['IN', 'RETURN'].includes(dto.type);

      if (isInflow) {
        newQty += dto.quantity;
      } else if (isDeduction) {
        newQty -= dto.quantity;
      } else if (dto.type === 'ADJUSTMENT') {
        newQty = dto.quantity;
      }

      // 3. Persist stock update
      await tx.update(inventoryStock)
        .set({ 
          quantity: String(newQty), 
          updatedAt: new Date() 
        })
        .where(eq(inventoryStock.id, dto.stockId));

      // 4. Record Ledger Entry (Full Accountability)
      const [transaction] = await tx.insert(inventoryTransactions).values({
        stockId: dto.stockId,
        type: dto.type,
        quantityChange: String(isDeduction ? -dto.quantity : dto.quantity),
        balanceAfter: String(newQty),
        remarks: dto.remarks || `Industrial ${dto.type} movement`,
        referenceId: dto.referenceId,
        performedBy: dto.performedBy,
        createdAt: new Date()
      }).returning();

      this.logger.log(`Stock Movement [${dto.type}]: ${stock.itemName} | ${currentQty} -> ${newQty}`);
      
      await this.auditService.logAction({
        userId: dto.performedBy,
        action: `STOCK_${dto.type}`,
        entityType: 'inventory_stock',
        entityId: dto.stockId,
        category: 'INVENTORY',
        payload: {
          itemName: stock.itemName,
          quantity: dto.quantity,
          movement: isDeduction ? 'DEDUCTION' : 'INFLOW',
          balanceBefore: currentQty,
          balanceAfter: newQty,
          remarks: dto.remarks
        }
      });

      await this.eventsService.emitDataChanged('inventory', { action: 'stock_updated', stockId: dto.stockId });
      return { stock: { ...stock, quantity: String(newQty) }, transaction };
    });
  }

  async createStockItem(dto: any) {
    const [item] = await db.insert(inventoryStock).values({
      ...dto,
      quantity: dto.quantity || '0',
    }).returning();
    await this.eventsService.emitDataChanged('inventory', { action: 'stock_item_created', id: item.id });
    return item;
  }


  async createWarehouse(dto: { name: string; type: string }) {
    const [warehouse] = await db.insert(warehouseLocations).values({
      ...dto,
      createdAt: new Date(),
    }).returning();
    return warehouse;
  }

  // ─── NEW SIMPLE INVENTORY IMPLEMENTATION ────────────────────────────

  async getCurrentMaterialBalance(materialId: string): Promise<number> {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!materialId || !UUID_REGEX.test(materialId)) {
      return 0;
    }

    const txs = await db.select({
      quantityChange: rawMaterialTransactions.quantityChange
    })
    .from(rawMaterialTransactions)
    .where(eq(rawMaterialTransactions.materialId, materialId));

    return sumRawMaterialTransactions(txs);
  }

  async getRawMaterials() {
    try {
      const materials = await db.select({
        id: rawMaterials.id,
        name: rawMaterials.name,
        unit: rawMaterials.unit,
        updatedAt: rawMaterials.updatedAt,
      })
      .from(rawMaterials)
      .orderBy(rawMaterials.name);

      const result = [];
      for (const m of materials) {
        const currentStock = await this.getCurrentMaterialBalance(m.id);
        result.push({
          ...m,
          currentStock,
        });
      }
      return result;
    } catch (error) {
      console.error('getRawMaterials CRASH:', error);
      throw error;
    }
  }

  async getRawMaterialLedger(materialId: string) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!materialId || !UUID_REGEX.test(materialId)) {
      return [];
    }
    const [material] = await db.select().from(rawMaterials).where(eq(rawMaterials.id, materialId)).limit(1);
    if (!material) return [];
    
    // 1. Fetch Admin Transactions
    const txs = await db.select({
      id: rawMaterialTransactions.id,
      type: rawMaterialTransactions.type,
      quantityChange: rawMaterialTransactions.quantityChange,
      remarks: rawMaterialTransactions.remarks,
      createdAt: rawMaterialTransactions.createdAt,
      userName: users.name
    })
    .from(rawMaterialTransactions)
    .leftJoin(users, eq(rawMaterialTransactions.performedBy, users.id))
    .where(eq(rawMaterialTransactions.materialId, materialId));
    
    // 2. Format transaction ledger. Production usage is already recorded as
    // rawMaterialTransactions, so reading productionLogs here would double count.
    const ledgerEntries: any[] = [];
    
    // Add Admin transactions
    txs.forEach(t => {
      ledgerEntries.push({
        id: t.id,
        type: t.type,
        quantityChange: Number(t.quantityChange),
        remarks: t.remarks || 'Stock Adjustment',
        createdAt: t.createdAt,
        userName: t.userName || 'Admin',
        unit: material.unit
      });
    });
    
    // Sort by date ascending to calculate running balance
    ledgerEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    let balance = 0;
    const sortedLedger = ledgerEntries.map(entry => {
      balance += entry.quantityChange;
      return {
        ...entry,
        balanceAfter: balance
      };
    });
    
    // Sort descending for display (newest first)
    return sortedLedger.reverse();
  }

  async getProductionStock() {
    // RED TEAM FIX: Removed 'await this.recalculateInventory();' here
    // Inventory recalculation is triggered on transaction changes. Calling it on GET causes massive latency.
    
    // Ensure all products have a row in productionStock
    const allProducts = await db.select().from(products);
    for (const prod of allProducts) {
      const existing = await db.select().from(productionStock).where(eq(productionStock.productId, prod.id)).limit(1);
      if (existing.length === 0) {
        await db.insert(productionStock).values({
          productId: prod.id,
          currentStock: 0,
          totalProduced: 0,
          totalDispatched: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }).catch(() => {});
      }
    }

    return await db.select({
      id: productionStock.id,
      productId: productionStock.productId,
      productName: products.name,
      currentStock: productionStock.currentStock,
      totalProduced: productionStock.totalProduced,
      totalDispatched: productionStock.totalDispatched,
      availableStock: productionStock.currentStock
    })
    .from(productionStock)
    .innerJoin(products, eq(productionStock.productId, products.id))
    .orderBy(products.name);
  }

  async addStockTransaction(dto: { itemId: string; itemType: 'RAW' | 'PRODUCT'; quantity: number; remarks?: string; performedBy: string }) {
    const result = await db.transaction(async (tx) => {
      if (dto.itemType === 'PRODUCT') {
        await tx.insert(productStockTransactions).values({
          productId: dto.itemId,
          type: 'ADD',
          quantityChange: dto.quantity,
          balanceAfter: 0,
          remarks: dto.remarks,
          performedBy: dto.performedBy,
          createdAt: new Date()
        });
      } else {
        await tx.insert(rawMaterialTransactions).values({
          materialId: dto.itemId,
          type: 'ADD',
          quantityChange: dto.quantity,
          balanceAfter: 0,
          remarks: dto.remarks,
          performedBy: dto.performedBy,
          createdAt: new Date()
        });
      }
      await this.recalculateInventory(tx);
    });
    await this.eventsService.emitDataChanged('inventory', { action: 'stock_transaction_created', itemId: dto.itemId, itemType: dto.itemType });
    return result;
  }

  async updateStockTransaction(dto: { transactionId: string; quantity: number; remarks?: string; performedBy: string }) {
    const result = await db.transaction(async (tx) => {
      const [rawTx] = await tx.select().from(rawMaterialTransactions).where(eq(rawMaterialTransactions.id, dto.transactionId)).limit(1);
      if (rawTx) {
        await tx.update(rawMaterialTransactions)
          .set({
            quantityChange: dto.quantity,
            remarks: dto.remarks,
            performedBy: dto.performedBy
          })
          .where(eq(rawMaterialTransactions.id, dto.transactionId));
      } else {
        const [prodTx] = await tx.select().from(productStockTransactions).where(eq(productStockTransactions.id, dto.transactionId)).limit(1);
        if (!prodTx) throw new Error('Transaction not found');

        await tx.update(productStockTransactions)
          .set({
            quantityChange: dto.quantity,
            remarks: dto.remarks,
            performedBy: dto.performedBy
          })
          .where(eq(productStockTransactions.id, dto.transactionId));
      }
      await this.recalculateInventory(tx);
    });
    await this.eventsService.emitDataChanged('inventory', { action: 'stock_transaction_updated', transactionId: dto.transactionId });
    return result;
  }

  async deleteStockTransaction(transactionId: string) {
    const result = await db.transaction(async (tx) => {
      const [rawTx] = await tx.select().from(rawMaterialTransactions).where(eq(rawMaterialTransactions.id, transactionId)).limit(1);
      if (rawTx) {
        await tx.delete(rawMaterialTransactions).where(eq(rawMaterialTransactions.id, transactionId));
      } else {
        const [prodTx] = await tx.select().from(productStockTransactions).where(eq(productStockTransactions.id, transactionId)).limit(1);
        if (!prodTx) throw new Error('Transaction not found');
        await tx.delete(productStockTransactions).where(eq(productStockTransactions.id, transactionId));
      }
      await this.recalculateInventory(tx);
    });
    await this.eventsService.emitDataChanged('inventory', { action: 'stock_transaction_deleted', transactionId });
    return result;
  }

  async recalculateInventory(tx?: any) {
    const runner = tx || db;

    const rawMaterialRows = await runner.select({ id: rawMaterials.id }).from(rawMaterials);
    for (const material of rawMaterialRows) {
      const [balanceRes] = await runner.select({
        sum: sql<string>`coalesce(sum(${rawMaterialTransactions.quantityChange}), '0')`
      })
      .from(rawMaterialTransactions)
      .where(eq(rawMaterialTransactions.materialId, material.id));

      await runner.update(rawMaterials)
        .set({
          currentStock: Number(balanceRes.sum || 0),
          updatedAt: new Date()
        })
        .where(eq(rawMaterials.id, material.id));
    }

    // 3. Recalculate Finished Goods Stock per Product
    const allProducts = await runner.select().from(products);
    for (const prod of allProducts) {
      const productBatchesList = await runner.select({ id: productionBatches.id })
        .from(productionBatches)
        .where(and(eq(productionBatches.productId, prod.id), isNull(productionBatches.deletedAt)));
      
      let totalProduced = 0;
      
      for (const b of productBatchesList) {
        // Finished goods stock is tracked in cases from the packing station.
        const [packedRes] = await runner.select({
          sum: sql<string>`coalesce(sum(${productionLogs.casesProduced}), '0')`
        })
        .from(productionLogs)
        .where(and(
          eq(productionLogs.batchId, b.id),
          eq(productionLogs.station, 'PACKING'),
          isNull(productionLogs.deletedAt)
        ));

        totalProduced += parseInt(packedRes.sum, 10);
      }
      
      // Calculate Dispatched
      const [dispatchRes] = await runner.select({
        sum: sql<string>`coalesce(sum(${dispatchLogs.quantity}), '0')`
      })
      .from(dispatchLogs)
      .innerJoin(productionBatches, eq(dispatchLogs.batchId, productionBatches.id))
      .where(and(
        eq(productionBatches.productId, prod.id),
        isNull(productionBatches.deletedAt)
      ));
      
      // Calculate Manual Inward / Adjustments
      const [manualRes] = await runner.select({
        sum: sql<string>`coalesce(sum(${productStockTransactions.quantityChange}), '0')`
      })
      .from(productStockTransactions)
      .where(eq(productStockTransactions.productId, prod.id));

      // Calculate Sales Transactions impact: RETURN is +qty, SALES_DISPATCH & DAMAGE are -qty
      const [salesRes] = await runner.select({
        sum: sql<string>`coalesce(sum(case when ${salesTransactions.type} = 'RETURN' then ${salesTransactions.quantity} else -${salesTransactions.quantity} end), '0')`
      })
      .from(salesTransactions)
      .where(eq(salesTransactions.productId, prod.id));

      const salesImpact = parseInt(salesRes.sum, 10);
      const manualAdded = parseInt(manualRes.sum, 10);
      const totalDispatched = parseInt(dispatchRes.sum, 10);
      const availableStock = totalProduced + manualAdded - totalDispatched + salesImpact;
      
      // Upsert
      const existing = await runner.select().from(productionStock).where(eq(productionStock.productId, prod.id)).limit(1);
      if (existing.length > 0) {
        await runner.update(productionStock)
          .set({
            currentStock: availableStock,
            totalProduced,
            totalDispatched,
            updatedAt: new Date()
          })
          .where(eq(productionStock.productId, prod.id));
      } else {
        await runner.insert(productionStock).values({
          productId: prod.id,
          currentStock: availableStock,
          totalProduced,
          totalDispatched,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  async getProductLedger(productId: string) {
    const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod) return [];

    // 1. Fetch manual product stock transactions
    const manualTxs = await db.select({
      id: productStockTransactions.id,
      type: productStockTransactions.type,
      quantityChange: productStockTransactions.quantityChange,
      remarks: productStockTransactions.remarks,
      createdAt: productStockTransactions.createdAt,
      userName: users.name
    })
    .from(productStockTransactions)
    .leftJoin(users, eq(productStockTransactions.performedBy, users.id))
    .where(eq(productStockTransactions.productId, productId));

    // 2. Fetch packing logs (Production Output in cases)
    const packingLogs = await db.select({
      id: productionLogs.id,
      casesProduced: productionLogs.casesProduced,
      createdAt: productionLogs.loggedAt,
      userName: users.name,
      batchCode: productionBatches.batchCode
    })
    .from(productionLogs)
    .leftJoin(users, eq(productionLogs.userId, users.id))
    .leftJoin(productionBatches, eq(productionLogs.batchId, productionBatches.id))
    .where(and(
      eq(productionLogs.productId, productId),
      eq(productionLogs.station, 'PACKING'),
      isNull(productionLogs.deletedAt)
    ));

    // 3. Fetch dispatches. Finished goods are counted as packed cases;
    // bottle-level leakage/rejection is already upstream of the packing count.
    const dispatches = await db.select({
      id: dispatchLogs.id,
      quantity: dispatchLogs.quantity,
      createdAt: dispatchLogs.dispatchedAt,
      userName: users.name,
      batchCode: productionBatches.batchCode
    })
    .from(dispatchLogs)
    .innerJoin(productionBatches, eq(dispatchLogs.batchId, productionBatches.id))
    .leftJoin(users, eq(dispatchLogs.dispatchManagerId, users.id))
    .where(and(
      eq(productionBatches.productId, productId),
      isNull(productionBatches.deletedAt)
    ));

    // 4. Fetch sales transactions
    const salesTxs = await db.select({
      id: salesTransactions.id,
      type: salesTransactions.type,
      quantity: salesTransactions.quantity,
      createdAt: salesTransactions.createdAt,
      userName: users.name
    })
    .from(salesTransactions)
    .leftJoin(users, eq(salesTransactions.performedBy, users.id))
    .where(eq(salesTransactions.productId, productId));

    // Merge and format
    const ledgerEntries: any[] = [];

    // Sales transactions
    salesTxs.forEach(t => {
      let typeLabel = '';
      let quantityChange = 0;
      let remarks = '';
      
      if (t.type === 'RETURN') {
        typeLabel = 'RETURN';
        quantityChange = t.quantity;
        remarks = 'Returned Product';
      } else if (t.type === 'SALES_DISPATCH') {
        typeLabel = 'SALES_DISPATCH';
        quantityChange = -t.quantity;
        remarks = 'Sales Dispatch';
      } else if (t.type === 'DAMAGE') {
        typeLabel = 'DAMAGE';
        quantityChange = -t.quantity;
        remarks = 'Damaged Product';
      }

      ledgerEntries.push({
        id: `sales_${t.id}`,
        type: typeLabel,
        quantityChange,
        remarks,
        createdAt: t.createdAt,
        userName: t.userName || 'Manager'
      });
    });

    // Manual transactions
    manualTxs.forEach(t => {
      ledgerEntries.push({
        id: t.id,
        type: t.type,
        quantityChange: Number(t.quantityChange),
        remarks: t.remarks || 'Stock Adjustment',
        createdAt: t.createdAt,
        userName: t.userName || 'Admin'
      });
    });

    // Production (Packing)
    packingLogs.forEach(l => {
      const casesProduced = Number(l.casesProduced || 0);
      if (casesProduced <= 0) return;
      ledgerEntries.push({
        id: `packing_${l.id}`,
        type: 'PRODUCTION',
        quantityChange: casesProduced,
        remarks: `Production Output (Batch #${l.batchCode})`,
        createdAt: l.createdAt,
        userName: l.userName || 'Operator'
      });
    });

    // Dispatches
    dispatches.forEach(d => {
      ledgerEntries.push({
        id: `dispatch_${d.id}`,
        type: 'DISPATCH',
        quantityChange: -d.quantity,
        remarks: `Dispatched Stock (Batch #${d.batchCode})`,
        createdAt: d.createdAt,
        userName: d.userName || 'Logistics'
      });
    });

    // Sort ascending by date to compute running balance
    ledgerEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let balance = 0;
    const sortedLedger = ledgerEntries.map(entry => {
      balance += entry.quantityChange;
      return {
        ...entry,
        balanceAfter: balance
      };
    });

    // Sort descending for display (newest first)
    return sortedLedger.reverse();
  }

  async getStationConsumption() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const logs = await db.select({
      station: productionLogs.station,
      bagsUsed: productionLogs.bagsUsed,
      capBoxUsage: productionLogs.capBoxUsage,
      bopRollUsage: productionLogs.bopRollUsage,
      shrinkWeightUsed: productionLogs.shrinkWeightUsed,
      loggedAt: productionLogs.loggedAt,
    })
    .from(productionLogs)
      .where(
        and(
        gte(productionLogs.loggedAt, thirtyDaysAgo),
        isNull(productionLogs.deletedAt)
      )
    );

    const stations = ['BLOWING', 'FILLING', 'LABELING', 'PACKING'] as const;
    const initialValues = () => ({ preforms: 0, caps: 0, labels: 0, shrinkFilm: 0 });

    const result = stations.reduce((acc, station) => {
      acc[station] = {
        today: initialValues(),
        weekly: initialValues(),
        monthly: initialValues(),
      };
      return acc;
    }, {} as Record<string, { today: any; weekly: any; monthly: any }>);

    for (const log of logs) {
      const station = log.station;
      if (!result[station]) continue;

      const loggedAt = new Date(log.loggedAt);

      const capsUsed = station === 'FILLING' ? Number(log.capBoxUsage || 0) : 0;
      const preformsUsed = station === 'BLOWING' ? Number(log.bagsUsed || 0) : 0;
      const labelsUsed = station === 'LABELING' ? Number(log.bopRollUsage || 0) : 0;
      const shrinkFilmUsed = station === 'PACKING' ? Number(log.shrinkWeightUsed || 0) : 0;

      const addToPeriod = (period: 'today' | 'weekly' | 'monthly') => {
        result[station][period].preforms += preformsUsed;
        result[station][period].caps += capsUsed;
        result[station][period].labels += labelsUsed;
        result[station][period].shrinkFilm += shrinkFilmUsed;
      };

      if (loggedAt >= todayStart) {
        addToPeriod('today');
        addToPeriod('weekly');
        addToPeriod('monthly');
      } else if (loggedAt >= sevenDaysAgo) {
        addToPeriod('weekly');
        addToPeriod('monthly');
      } else if (loggedAt >= thirtyDaysAgo) {
        addToPeriod('monthly');
      }
    }

    return result;
  }
}
