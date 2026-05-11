import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { 
  inventoryStock, 
  inventoryTransactions, 
  materialCategories, 
  warehouseLocations, 
  packagingConfigurations,
  factories 
} from '../../database/schema';
import { eq, sql, desc } from 'drizzle-orm';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  private async getFactoryContext(): Promise<string> {
    const results = await db.select().from(factories).limit(1);
    if (!results.length) return 'default-factory-id';
    return results[0].id;
  }

  constructor() {}

  async getInventory() {
    // Join with categories for better UI
    return await db.select({
      id: inventoryStock.id,
      itemName: inventoryStock.itemName,
      sku: inventoryStock.sku,
      unit: inventoryStock.unit,
      quantity: inventoryStock.quantity,
      minimumStock: inventoryStock.minimumStock,
      categoryName: materialCategories.name,
      warehouseName: warehouseLocations.name,
    })
    .from(inventoryStock)
    .leftJoin(materialCategories, eq(inventoryStock.categoryId, materialCategories.id))
    .leftJoin(warehouseLocations, eq(inventoryStock.warehouseId, warehouseLocations.id))
    .orderBy(inventoryStock.itemName);
  }

  async getMaterialLedger(stockId: string) {
    return await db.select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.stockId, stockId))
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(100);
  }

  async getPackagingConfigs(productId: string) {
    return await db.select()
      .from(packagingConfigurations)
      .where(eq(packagingConfigurations.productId, productId));
  }

  async getWarehouses() {
    return await db.select().from(warehouseLocations);
  }

  async getCategories() {
    return await db.select().from(materialCategories);
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
        if (currentQty < dto.quantity && dto.type !== 'ADJUSTMENT') {
          throw new Error(`INSUFFICIENT_STOCK: Required ${dto.quantity}, Available ${currentQty} for ${stock.itemName}`);
        }
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
      return { stock: { ...stock, quantity: String(newQty) }, transaction };
    });
  }

  async createStockItem(dto: any) {
    const factoryId = await this.getFactoryContext();
    const [item] = await db.insert(inventoryStock).values({
      ...dto,
      factoryId,
      quantity: dto.quantity || '0',
    }).returning();
    return item;
  }
}
