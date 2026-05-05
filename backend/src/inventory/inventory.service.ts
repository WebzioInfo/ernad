import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/db';
import { rawMaterials, stockTransactions, factories } from '../db/schema';
import { eq, sql, desc } from 'drizzle-orm';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  private async getFactoryContext(factoryId?: string): Promise<string> {
    if (factoryId) return factoryId;
    const results = await db.select().from(factories).limit(1);
    if (!results.length) return 'default-factory-id';
    return results[0].id;
  }

  constructor() {}

  async getInventory() {
    // Return all materials with their current stock levels
    return await db.select().from(rawMaterials).orderBy(rawMaterials.name);
  }

  async getMaterialLedger(materialId: string) {
    // Return transaction history for a specific material
    return await db.select()
      .from(stockTransactions)
      .where(eq(stockTransactions.materialId, materialId))
      .orderBy(desc(stockTransactions.createdAt))
      .limit(50);
  }

  async updateStock(factoryIdArg: string | undefined, dto: { 
    materialId: string; 
    quantity: number; 
    type: 'IN' | 'OUT' | 'ADJUSTMENT'; 
    remarks?: string; 
    referenceId?: string;
  }) {
    const factoryId = await this.getFactoryContext(factoryIdArg);
    return await db.transaction(async (tx) => {
      // 1. Record in Ledger
      await tx.insert(stockTransactions).values({
        materialId: dto.materialId,
        factoryId,
        type: dto.type,
        quantity: dto.quantity.toString(),
        remarks: dto.remarks,
        referenceId: dto.referenceId,
      });

      // 2. Update Master Balance (Current Stock)
      const operator = dto.type === 'IN' ? '+' : dto.type === 'OUT' ? '-' : '=';
      
      if (operator === '=') {
        await tx.update(rawMaterials)
          .set({ currentStock: dto.quantity.toString() })
          .where(eq(rawMaterials.id, dto.materialId));
      } else {
        await tx.update(rawMaterials)
          .set({ 
            currentStock: sql`${rawMaterials.currentStock} ${sql.raw(operator)} ${dto.quantity.toString()}` 
          })
          .where(eq(rawMaterials.id, dto.materialId));
      }

      const [updated] = await tx.select().from(rawMaterials).where(eq(rawMaterials.id, dto.materialId));
      this.logger.log(`Inventory updated for material ${dto.materialId}. New balance: ${updated.currentStock}`);
      return updated;
    });
  }

  async createMaterial(factoryIdArg: string | undefined, dto: { name: string; unit: string; category?: string; minimumStock?: string }) {
    const factoryId = await this.getFactoryContext(factoryIdArg);
    const [material] = await db.insert(rawMaterials).values({
      ...dto,
      factoryId,
      currentStock: '0',
      minimumStock: dto.minimumStock || '0',
    }).returning();
    return material;
  }
}
