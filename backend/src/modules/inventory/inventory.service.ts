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
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'CONSUMPTION'; 
    remarks?: string; 
    referenceId?: string;
    performedBy?: string;
  }) {
    return await db.transaction(async (tx) => {
      const [stock] = await tx.select().from(inventoryStock).where(eq(inventoryStock.id, dto.stockId)).for('update');
      if (!stock) throw new Error('Stock item not found');

      const currentQty = Number(stock.quantity);
      let newQty = currentQty;

      if (dto.type === 'IN') newQty += dto.quantity;
      else if (dto.type === 'OUT' || dto.type === 'CONSUMPTION') newQty -= dto.quantity;
      else if (dto.type === 'ADJUSTMENT') newQty = dto.quantity;

      // 1. Update stock
      await tx.update(inventoryStock)
        .set({ quantity: String(newQty), updatedAt: new Date() })
        .where(eq(inventoryStock.id, dto.stockId));

      // 2. Record transaction
      const [transaction] = await tx.insert(inventoryTransactions).values({
        stockId: dto.stockId,
        type: dto.type,
        quantityChange: String(dto.type === 'OUT' || dto.type === 'CONSUMPTION' ? -dto.quantity : dto.quantity),
        balanceAfter: String(newQty),
        remarks: dto.remarks,
        referenceId: dto.referenceId,
        performedBy: dto.performedBy,
      }).returning();

      this.logger.log(`Stock ${dto.stockId} updated: ${currentQty} -> ${newQty} (${dto.type})`);
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
