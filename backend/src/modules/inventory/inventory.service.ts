import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
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
      const materialsWithStock = await db.select({
        id: rawMaterials.id,
        name: rawMaterials.name,
        unit: rawMaterials.unit,
        updatedAt: rawMaterials.updatedAt,
        currentStockSum: sql<string>`COALESCE(SUM(${rawMaterialTransactions.quantityChange}), '0')`
      })
      .from(rawMaterials)
      .leftJoin(rawMaterialTransactions, eq(rawMaterialTransactions.materialId, rawMaterials.id))
      .groupBy(rawMaterials.id, rawMaterials.name, rawMaterials.unit, rawMaterials.updatedAt)
      .orderBy(rawMaterials.name);

      return materialsWithStock.map(m => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        updatedAt: m.updatedAt,
        currentStock: Number(m.currentStockSum || 0),
      }));
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
          currentStock: '0',
          totalProduced: '0',
          totalDispatched: '0',
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
      availableStock: productionStock.currentStock,
      brandId: products.brandId
    })
    .from(productionStock)
    .innerJoin(products, eq(productionStock.productId, products.id))
    .orderBy(products.name);
  }

  async addStockTransaction(dto: { itemId: string; itemType: 'RAW' | 'PRODUCT'; quantity: number; remarks?: string; performedBy: string }) {
    const result = await db.transaction(async (tx) => {
      if (dto.itemType === 'PRODUCT') {
        const qty = Number(dto.quantity);
        
        const existing = await tx.select().from(productionStock).where(eq(productionStock.productId, dto.itemId)).limit(1);
        
        let newStock = qty;
        let newProduced = 0;
        let newDispatched = 0;
        
        if (existing.length > 0) {
          newStock = Number(existing[0].currentStock) + qty;
          newProduced = Number(existing[0].totalProduced);
          newDispatched = Number(existing[0].totalDispatched);

          await tx.update(productionStock)
            .set({ currentStock: String(newStock), updatedAt: new Date() })
            .where(eq(productionStock.productId, dto.itemId));
        } else {
          await tx.insert(productionStock).values({
            productId: dto.itemId, currentStock: String(qty), totalProduced: '0', totalDispatched: '0',
            createdAt: new Date(), updatedAt: new Date()
          });
        }

        // Insert log with snapshots
        await tx.insert(productStockTransactions).values({
          productId: dto.itemId,
          type: qty > 0 ? 'ADD' : 'DEDUCT',
          quantityChange: String(qty),
          balanceAfter: String(newStock),
          stockBalanceAfter: String(newStock),
          producedBalanceAfter: String(newProduced),
          dispatchedBalanceAfter: String(newDispatched),
          remarks: dto.remarks,
          performedBy: dto.performedBy,
          createdAt: new Date()
        });
      } else {
        const qty = Number(dto.quantity);
        await tx.insert(rawMaterialTransactions).values({
          materialId: dto.itemId,
          type: qty > 0 ? 'ADD' : 'DEDUCT',
          quantityChange: String(qty),
          balanceAfter: '0',
          remarks: dto.remarks,
          performedBy: dto.performedBy,
          createdAt: new Date()
        });

        await tx.update(rawMaterials)
          .set({ currentStock: sql`${rawMaterials.currentStock} + ${qty}`, updatedAt: new Date() })
          .where(eq(rawMaterials.id, dto.itemId));
      }
    });
    await this.eventsService.emitDataChanged('inventory', { action: 'stock_transaction_created', itemId: dto.itemId, itemType: dto.itemType });
    return result;
  }

  async updateStockTransaction(dto: { transactionId: string; quantity: number; remarks?: string; performedBy: string }) {
    const result = await db.transaction(async (tx) => {
      const newQty = Number(dto.quantity);
      
      const [rawTx] = await tx.select().from(rawMaterialTransactions).where(eq(rawMaterialTransactions.id, dto.transactionId)).limit(1);
      if (rawTx) {
        const diff = newQty - Number(rawTx.quantityChange);
        await tx.update(rawMaterialTransactions)
          .set({ quantityChange: String(newQty), remarks: dto.remarks, performedBy: dto.performedBy })
          .where(eq(rawMaterialTransactions.id, dto.transactionId));
          
        await tx.update(rawMaterials)
          .set({ currentStock: sql`${rawMaterials.currentStock} + ${diff}`, updatedAt: new Date() })
          .where(eq(rawMaterials.id, rawTx.materialId));
      } else {
        const [prodTx] = await tx.select().from(productStockTransactions).where(eq(productStockTransactions.id, dto.transactionId)).limit(1);
        if (!prodTx) throw new Error('Transaction not found');
        const diff = newQty - Number(prodTx.quantityChange);

        await tx.update(productStockTransactions)
          .set({ quantityChange: String(newQty), remarks: dto.remarks, performedBy: dto.performedBy })
          .where(eq(productStockTransactions.id, dto.transactionId));
          
        await tx.update(productionStock)
          .set({ currentStock: sql`${productionStock.currentStock} + ${diff}`, updatedAt: new Date() })
          .where(eq(productionStock.productId, prodTx.productId));
      }
    });
    await this.eventsService.emitDataChanged('inventory', { action: 'stock_transaction_updated', transactionId: dto.transactionId });
    return result;
  }

  async deleteStockTransaction(transactionId: string) {
    const result = await db.transaction(async (tx) => {
      const [rawTx] = await tx.select().from(rawMaterialTransactions).where(eq(rawMaterialTransactions.id, transactionId)).limit(1);
      if (rawTx) {
        await tx.delete(rawMaterialTransactions).where(eq(rawMaterialTransactions.id, transactionId));
        await tx.update(rawMaterials)
          .set({ currentStock: sql`${rawMaterials.currentStock} - ${Number(rawTx.quantityChange)}`, updatedAt: new Date() })
          .where(eq(rawMaterials.id, rawTx.materialId));
      } else {
        const [prodTx] = await tx.select().from(productStockTransactions).where(eq(productStockTransactions.id, transactionId)).limit(1);
        if (!prodTx) throw new Error('Transaction not found');
        
        await tx.delete(productStockTransactions).where(eq(productStockTransactions.id, transactionId));
        await tx.update(productionStock)
          .set({ currentStock: sql`${productionStock.currentStock} - ${Number(prodTx.quantityChange)}`, updatedAt: new Date() })
          .where(eq(productionStock.productId, prodTx.productId));
      }
    });
    await this.eventsService.emitDataChanged('inventory', { action: 'stock_transaction_deleted', transactionId });
    return result;
  }

  async recalculateInventory(tx?: any) {
    const runner = tx || db;

    // 1. Bulk raw materials current stock recalculation in a single query
    await runner.execute(sql`
      UPDATE raw_materials rm
      SET current_stock = COALESCE((
        SELECT SUM(quantity_change)
        FROM raw_material_transactions rmt
        WHERE rmt.material_id = rm.id
      ), 0),
      updated_at = NOW()
    `);

    // 2. Ensure all products have a productionStock row
    const allProducts = await runner.select().from(products);
    for (const prod of allProducts) {
      const existing = await runner.select().from(productionStock).where(eq(productionStock.productId, prod.id)).limit(1);
      if (existing.length === 0) {
        await runner.insert(productionStock).values({
          productId: prod.id,
          currentStock: '0',
          totalProduced: '0',
          totalDispatched: '0',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // 3. Bulk production stock totalProduced recalculation in a single query
    await runner.execute(sql`
      UPDATE production_stock ps
      SET total_produced = COALESCE((
        SELECT SUM(pl.cases_produced)
        FROM production_logs pl
        INNER JOIN production_batches pb ON pl.batch_id = pb.id
        WHERE pb.product_id = ps.product_id
          AND pl.station = 'PACKING'
          AND pl.deleted_at IS NULL
          AND pb.deleted_at IS NULL
      ), 0) + COALESCE((
        SELECT SUM(pst.quantity_change)
        FROM product_stock_transactions pst
        WHERE pst.product_id = ps.product_id
          AND pst.type = 'MANUAL_PRODUCED_ADJUST'
      ), 0),
      updated_at = NOW()
    `);

    // 4. Bulk production stock totalDispatched recalculation in a single query
    await runner.execute(sql`
      UPDATE production_stock ps
      SET total_dispatched = COALESCE((
        SELECT SUM(dl.quantity)
        FROM dispatch_logs dl
        INNER JOIN production_batches pb ON dl.batch_id = pb.id
        WHERE pb.product_id = ps.product_id
          AND pb.deleted_at IS NULL
      ), 0) + COALESCE((
        SELECT SUM(st.quantity)
        FROM sales_transactions st
        WHERE st.product_id = ps.product_id
          AND st.type = 'SALES_DISPATCH'
      ), 0) + COALESCE((
        SELECT SUM(pst.quantity_change)
        FROM product_stock_transactions pst
        WHERE pst.product_id = ps.product_id
          AND pst.type = 'MANUAL_DISPATCH_ADJUST'
      ), 0),
      updated_at = NOW()
    `);

    // 5. Bulk production stock currentStock recalculation (availableStock) in a single query
    await runner.execute(sql`
      UPDATE production_stock ps
      SET current_stock = ps.total_produced 
          + COALESCE((
              SELECT SUM(pst.quantity_change)
              FROM product_stock_transactions pst
              WHERE pst.product_id = ps.product_id
                AND pst.type NOT IN ('MANUAL_PRODUCED_ADJUST', 'MANUAL_DISPATCH_ADJUST')
            ), 0)
          - ps.total_dispatched
          + COALESCE((
              SELECT SUM(CASE 
                WHEN st.type = 'RETURN' THEN st.quantity 
                WHEN st.type = 'DAMAGE' THEN -st.quantity 
                ELSE 0 
              END)
              FROM sales_transactions st
              WHERE st.product_id = ps.product_id
            ), 0),
      updated_at = NOW()
    `);
  }

  async getProductLedger(productId: string) {
    const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!prod) return [];

    // Fetch all history without limits to calculate accurate snapshots
    const [manualTxs, packingLogs, dispatches, salesTxs] = await Promise.all([
      db.select({
        id: productStockTransactions.id,
        type: productStockTransactions.type,
        quantityChange: productStockTransactions.quantityChange,
        remarks: productStockTransactions.remarks,
        createdAt: productStockTransactions.createdAt,
        performedById: productStockTransactions.performedBy,
        userName: users.name,
        stockBalanceAfter: productStockTransactions.stockBalanceAfter,
        producedBalanceAfter: productStockTransactions.producedBalanceAfter,
        dispatchedBalanceAfter: productStockTransactions.dispatchedBalanceAfter,
      })
      .from(productStockTransactions)
      .leftJoin(users, eq(productStockTransactions.performedBy, users.id))
      .where(eq(productStockTransactions.productId, productId)),

      db.select({
        id: productionLogs.id,
        casesProduced: productionLogs.casesProduced,
        remarks: productionLogs.remarks,
        createdAt: productionLogs.loggedAt,
        performedById: productionLogs.userId,
        userName: users.name,
        batchCode: productionBatches.batchCode,
        stockBalanceAfter: productionLogs.stockBalanceAfter,
        producedBalanceAfter: productionLogs.producedBalanceAfter,
        dispatchedBalanceAfter: productionLogs.dispatchedBalanceAfter,
      })
      .from(productionLogs)
      .leftJoin(users, eq(productionLogs.userId, users.id))
      .leftJoin(productionBatches, eq(productionLogs.batchId, productionBatches.id))
      .where(and(
        eq(productionLogs.productId, productId),
        eq(productionLogs.station, 'PACKING'),
        isNull(productionLogs.deletedAt)
      )),

      db.select({
        id: dispatchLogs.id,
        quantity: dispatchLogs.quantity,
        remarks: dispatchLogs.remarks,
        createdAt: dispatchLogs.dispatchedAt,
        performedById: dispatchLogs.dispatchManagerId,
        userName: users.name,
        batchCode: productionBatches.batchCode,
        stockBalanceAfter: dispatchLogs.stockBalanceAfter,
        producedBalanceAfter: dispatchLogs.producedBalanceAfter,
        dispatchedBalanceAfter: dispatchLogs.dispatchedBalanceAfter,
      })
      .from(dispatchLogs)
      .innerJoin(productionBatches, eq(dispatchLogs.batchId, productionBatches.id))
      .leftJoin(users, eq(dispatchLogs.dispatchManagerId, users.id))
      .where(and(
        eq(productionBatches.productId, productId),
        isNull(productionBatches.deletedAt)
      )),

      db.select({
        id: salesTransactions.id,
        type: salesTransactions.type,
        quantity: salesTransactions.quantity,
        salesDate: salesTransactions.salesDate,
        createdAt: salesTransactions.createdAt,
        remarks: salesTransactions.remarks,
        performedById: salesTransactions.performedBy,
        userName: users.name,
        stockBalanceAfter: salesTransactions.stockBalanceAfter,
        producedBalanceAfter: salesTransactions.producedBalanceAfter,
        dispatchedBalanceAfter: salesTransactions.dispatchedBalanceAfter,
      })
      .from(salesTransactions)
      .leftJoin(users, eq(salesTransactions.performedBy, users.id))
      .where(eq(salesTransactions.productId, productId))
    ]);

    const ledgerEntries: any[] = [];
    const requireNumber = (value: unknown, field: string, id: string): number => {
      const parsed = typeof value === 'number' ? value : Number(value);
      if (value === null || value === undefined || !Number.isFinite(parsed)) {
        throw new InternalServerErrorException(`Ledger integrity error: ${field} is missing or invalid for ${id}`);
      }
      return parsed;
    };
    const requireUserName = (name: string | null, userId: string | null, id: string): string => {
      if (!userId || !name?.trim()) {
        throw new InternalServerErrorException(`Ledger integrity error: user relationship is invalid for ${id}`);
      }
      return name;
    };

    salesTxs.forEach(t => {
      let typeLabel = '';
      const sourceQuantity = requireNumber(t.quantity, 'quantity', `sales:${t.id}`);
      let quantityChange: number;
      let remarks: string;
      let impact = { stock: 0, produced: 0, dispatched: 0 };
      
      if (t.type === 'RETURN') {
        typeLabel = 'RETURN';
        quantityChange = sourceQuantity;
        remarks = t.remarks || 'Returned Product';
        impact = { stock: sourceQuantity, produced: 0, dispatched: 0 };
      } else if (t.type === 'SALES_DISPATCH') {
        typeLabel = 'SALES_DISPATCH';
        quantityChange = -sourceQuantity;
        remarks = t.remarks || 'Sales Dispatch';
        impact = { stock: -sourceQuantity, produced: 0, dispatched: sourceQuantity };
      } else if (t.type === 'DAMAGE') {
        typeLabel = 'DAMAGE';
        quantityChange = -sourceQuantity;
        remarks = t.remarks || 'Damaged Product';
        impact = { stock: -sourceQuantity, produced: 0, dispatched: 0 };
      } else {
        throw new InternalServerErrorException(`Ledger integrity error: unsupported sales transaction type ${t.type}`);
      }

      const userName = requireUserName(t.userName, t.performedById, `sales:${t.id}`);

      ledgerEntries.push({
        id: `sales_${t.id}`,
        transactionType: typeLabel,
        quantity: quantityChange,
        remarks,
        createdAt: t.salesDate,
        performedByName: userName,
        impact,
        stockBalanceAfter: t.stockBalanceAfter,
        producedBalanceAfter: t.producedBalanceAfter,
        dispatchedBalanceAfter: t.dispatchedBalanceAfter,
        snapshotSource: 'sales',
        sourceId: t.id,
      });
    });

    manualTxs.forEach(t => {
      let impact = { stock: 0, produced: 0, dispatched: 0 };
      const qty = requireNumber(t.quantityChange, 'quantityChange', `manual:${t.id}`);
      
      if (t.type === 'MANUAL_PRODUCED_ADJUST') {
        impact = { stock: 0, produced: qty, dispatched: 0 };
      } else if (t.type === 'MANUAL_DISPATCH_ADJUST') {
        impact = { stock: 0, produced: 0, dispatched: qty };
      } else {
        impact = { stock: qty, produced: 0, dispatched: 0 };
      }

      const userName = requireUserName(t.userName, t.performedById, `manual:${t.id}`);

      ledgerEntries.push({
        id: t.id,
        transactionType: t.type,
        quantity: qty,
        quantityChange: qty,
        remarks: t.remarks,
        createdAt: t.createdAt,
        performedByName: userName,
        impact,
        stockBalanceAfter: t.stockBalanceAfter,
        producedBalanceAfter: t.producedBalanceAfter,
        dispatchedBalanceAfter: t.dispatchedBalanceAfter,
        snapshotSource: 'manual',
        sourceId: t.id,
      });
    });

    packingLogs.forEach(l => {
      const casesProduced = requireNumber(l.casesProduced, 'casesProduced', `production:${l.id}`);
      const userName = requireUserName(l.userName, l.performedById, `production:${l.id}`);
      ledgerEntries.push({
        id: `packing_${l.id}`,
        transactionType: 'PRODUCTION',
        quantity: casesProduced,
        quantityChange: casesProduced,
        remarks: l.remarks || `Production Output (Batch #${l.batchCode})`,
        batchCode: l.batchCode,
        createdAt: l.createdAt,
        performedByName: userName,
        impact: { stock: casesProduced, produced: casesProduced, dispatched: 0 },
        stockBalanceAfter: l.stockBalanceAfter,
        producedBalanceAfter: l.producedBalanceAfter,
        dispatchedBalanceAfter: l.dispatchedBalanceAfter,
        snapshotSource: 'production',
        sourceId: l.id,
      });
    });

    dispatches.forEach(d => {
      const quantity = requireNumber(d.quantity, 'quantity', `dispatch:${d.id}`);
      const userName = requireUserName(d.userName, d.performedById, `dispatch:${d.id}`);
      ledgerEntries.push({
        id: `dispatch_${d.id}`,
        transactionType: 'DISPATCH',
        quantity: -quantity,
        quantityChange: -quantity,
        remarks: d.remarks || `Dispatched Stock (Batch #${d.batchCode})`,
        batchCode: d.batchCode,
        createdAt: d.createdAt,
        performedByName: userName,
        impact: { stock: -quantity, produced: 0, dispatched: quantity },
        stockBalanceAfter: d.stockBalanceAfter,
        producedBalanceAfter: d.producedBalanceAfter,
        dispatchedBalanceAfter: d.dispatchedBalanceAfter,
        snapshotSource: 'dispatch',
        sourceId: d.id,
      });
    });

    // Sort ascending by date to chronologically replay
    ledgerEntries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let runningStock = 0;
    let runningProduced = 0;
    let runningDispatched = 0;

    for (const entry of ledgerEntries) {
      entry.previousStock = parseFloat(runningStock as any);
      entry.previousProduced = parseFloat(runningProduced as any);
      entry.previousDispatched = parseFloat(runningDispatched as any);

      runningStock += entry.impact.stock;
      runningProduced += entry.impact.produced;
      runningDispatched += entry.impact.dispatched;

      const snapshotsMissing = entry.stockBalanceAfter == null
        || entry.producedBalanceAfter == null
        || entry.dispatchedBalanceAfter == null;

      if (snapshotsMissing) {
        const snapshots = {
          stockBalanceAfter: String(runningStock),
          producedBalanceAfter: String(runningProduced),
          dispatchedBalanceAfter: String(runningDispatched),
        };
        if (entry.snapshotSource === 'sales') await db.update(salesTransactions).set(snapshots).where(eq(salesTransactions.id, entry.sourceId));
        else if (entry.snapshotSource === 'manual') await db.update(productStockTransactions).set(snapshots).where(eq(productStockTransactions.id, entry.sourceId));
        else if (entry.snapshotSource === 'production') await db.update(productionLogs).set(snapshots).where(eq(productionLogs.id, entry.sourceId));
        else if (entry.snapshotSource === 'dispatch') await db.update(dispatchLogs).set(snapshots).where(eq(dispatchLogs.id, entry.sourceId));
        entry.stockBalanceAfter = runningStock;
        entry.producedBalanceAfter = runningProduced;
        entry.dispatchedBalanceAfter = runningDispatched;
      } else {
        entry.stockBalanceAfter = requireNumber(entry.stockBalanceAfter, 'stockBalanceAfter', entry.id);
        entry.producedBalanceAfter = requireNumber(entry.producedBalanceAfter, 'producedBalanceAfter', entry.id);
        entry.dispatchedBalanceAfter = requireNumber(entry.dispatchedBalanceAfter, 'dispatchedBalanceAfter', entry.id);
      }

      delete entry.snapshotSource;
      delete entry.sourceId;
    }

    // Reverse for descending display and take top 100
    ledgerEntries.reverse();
    return ledgerEntries.slice(0, 100);
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
