import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { db } from '../db/db';
import { productionLines, shifts, products, productBrands, rawMaterials, stockTransactions } from '../db/schema';

@Injectable()
export class FactoryConfigService {
  async getLines() {
    try {
      return await db.select().from(productionLines);
    } catch (error) {
      console.error('[FactoryConfigService] getLines Error:', error);
      throw error;
    }
  }

  async createLine(factoryId: string, dto: { name: string; description?: string }) {
    try {
      if (!factoryId) {
        throw new BadRequestException('Operation requires an assigned factory context.');
      }
      const existingLines = await db.select().from(productionLines).where(eq(productionLines.factoryId, factoryId));
      if (existingLines.length >= 2) {
        throw new BadRequestException('Factory is limited to exactly 2 production lines (Line 1 & Line 2).');
      }

      if (!['Line 1', 'Line 2'].includes(dto.name)) {
        throw new BadRequestException('Invalid line name. Must be "Line 1" or "Line 2".');
      }

      const [line] = await db.insert(productionLines).values({
        name: dto.name,
        description: dto.description,
        factoryId,
        status: 'IDLE',
      }).returning();
      return line;
    } catch (error) {
      console.error('[FactoryConfigService] createLine Error:', error);
      throw error;
    }
  }

  async updateLine(id: string, dto: { name?: string; description?: string; status?: string }) {
    const [line] = await db.update(productionLines)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(productionLines.id, id))
      .returning();
    return line;
  }

  async deleteLine(id: string) {
    await db.delete(productionLines).where(eq(productionLines.id, id));
    return { success: true };
  }

  async getShifts() {
    return await db.select().from(shifts);
  }

  async getProducts() {
    return await db.select().from(products);
  }

  async getBrands() {
    return await db.select().from(productBrands);
  }

  async getRawMaterials() {
    return await db.select().from(rawMaterials);
  }

  async getCurrentShift() {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const allShifts = await this.getShifts();
    
    // Cross-midnight logic
    for (const shift of allShifts) {
      const { startTime, endTime } = shift;
      if (startTime <= endTime) {
        // Normal shift (e.g., 06:00 - 14:00)
        if (timeStr >= startTime && timeStr < endTime) return shift;
      } else {
        // Cross-midnight shift (e.g., 22:00 - 06:00)
        if (timeStr >= startTime || timeStr < endTime) return shift;
      }
    }
    
    return null;
  }

  async createProduct(factoryId: string, dto: { name: string; sku?: string; brandId: string; category?: string }) {
    if (!factoryId) throw new BadRequestException('Operation requires an assigned factory.');
    const [product] = await db.insert(products).values({ ...dto, factoryId }).returning();
    return product;
  }

  async createBrand(dto: { name: string }) {
    const [brand] = await db.insert(productBrands).values(dto).returning();
    return brand;
  }

  async createRawMaterial(factoryId: string, dto: { name: string; unit: string; category?: string; currentStock?: string; minimumStock?: string }) {
    if (!factoryId) throw new BadRequestException('Operation requires an assigned factory.');
    const [material] = await db.insert(rawMaterials).values({
      ...dto,
      factoryId,
      currentStock: dto.currentStock || '0',
      minimumStock: dto.minimumStock || '0',
    }).returning();
    return material;
  }

  async updateStock(factoryId: string, dto: { materialId: string; quantity: number; type: 'IN' | 'OUT' | 'ADJUSTMENT'; remarks?: string; referenceId?: string }) {
    return await db.transaction(async (tx) => {
      // 1. Record transaction
      await tx.insert(stockTransactions).values({
        materialId: dto.materialId,
        factoryId,
        type: dto.type,
        quantity: dto.quantity.toString(),
        remarks: dto.remarks,
        referenceId: dto.referenceId,
      });

      // 2. Update current stock
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
      return updated;
    });
  }

  async updateBrand(id: string, dto: { name: string }) {
    const [brand] = await db.update(productBrands)
      .set({ ...dto })
      .where(eq(productBrands.id, id))
      .returning();
    return brand;
  }

  async deleteBrand(id: string) {
    await db.delete(productBrands).where(eq(productBrands.id, id));
    return { success: true };
  }

  async updateProduct(id: string, dto: any) {
    const [product] = await db.update(products)
      .set({ ...dto })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string) {
    await db.delete(products).where(eq(products.id, id));
    return { success: true };
  }

  async updateRawMaterial(id: string, dto: any) {
    const [material] = await db.update(rawMaterials)
      .set({ ...dto })
      .where(eq(rawMaterials.id, id))
      .returning();
    return material;
  }

  async deleteRawMaterial(id: string) {
    await db.delete(rawMaterials).where(eq(rawMaterials.id, id));
    return { success: true };
  }

  async createShift(factoryId: string, dto: { name: string; startTime: string; endTime: string }) {
    if (!factoryId) throw new BadRequestException('Operation requires an assigned factory.');
    const [shift] = await db.insert(shifts).values({ ...dto, factoryId }).returning();
    return shift;
  }

  async updateShift(id: string, dto: { name?: string; startTime?: string; endTime?: string }) {
    const [shift] = await db.update(shifts)
      .set({ ...dto })
      .where(eq(shifts.id, id))
      .returning();
    return shift;
  }

  async deleteShift(id: string) {
    await db.delete(shifts).where(eq(shifts.id, id));
    return { success: true };
  }
}

