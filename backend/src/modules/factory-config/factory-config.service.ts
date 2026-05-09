import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, sql, and, inArray } from 'drizzle-orm';

import { db } from '../../database/db';
import { productionLines, products, productBrands, rawMaterials, stockTransactions, factories, productionBatches } from '../../database/schema';

@Injectable()
export class FactoryConfigService {
  private async getFactoryContext(): Promise<string> {
    const [factory] = await db.select().from(factories).limit(1);
    if (!factory) throw new BadRequestException('No factory configured in system.');
    return factory.id;
  }

  async getLines() {
    const factoryId = await this.getFactoryContext();
    const results = await db.select({
      line: productionLines,
      batch: {
        id: productionBatches.id,
        batchCode: productionBatches.batchCode,
        status: productionBatches.status,
        productId: productionBatches.productId,
        brandId: productionBatches.brandId,
        productName: products.name,
        brandName: productBrands.name
      }
    })
    .from(productionLines)
    .leftJoin(productionBatches, and(
      eq(productionLines.id, productionBatches.lineId),
      inArray(productionBatches.status, ['RUNNING', 'CHANGEOVER'])
    ))
    .leftJoin(products, eq(productionBatches.productId, products.id))
    .leftJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
    .where(eq(productionLines.factoryId, factoryId));

    return results.map(r => ({
      ...r.line,
      batch: r.batch.id ? r.batch : null
    }));
  }

  async createLine(dto: { name: string; description?: string }) {
    try {
      const factoryId = await this.getFactoryContext();
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

  async getProducts() {
    const factoryId = await this.getFactoryContext();
    return await db.select().from(products).where(eq(products.factoryId, factoryId));
  }

  async getBrands() {
    return await db.select().from(productBrands);
  }

  async getRawMaterials() {
    const factoryId = await this.getFactoryContext();
    return await db.select().from(rawMaterials).where(eq(rawMaterials.factoryId, factoryId));
  }

  async createProduct(dto: { name: string; sku?: string; brandId: string; category?: string }) {
    const factoryId = await this.getFactoryContext();
    const [product] = await db.insert(products).values({ ...dto, factoryId }).returning();
    return product;
  }

  async createBrand(dto: { name: string }) {
    const [brand] = await db.insert(productBrands).values(dto).returning();
    return brand;
  }

  async createRawMaterial(dto: { name: string; unit: string; category?: string; currentStock?: string; minimumStock?: string }) {
    const factoryId = await this.getFactoryContext();
    const [material] = await db.insert(rawMaterials).values({
      ...dto,
      factoryId,
      currentStock: dto.currentStock || '0',
      minimumStock: dto.minimumStock || '0',
    }).returning();
    return material;
  }

  async updateStock(dto: { materialId: string; quantity: number; type: 'IN' | 'OUT' | 'ADJUSTMENT'; remarks?: string; referenceId?: string }) {
    const factoryId = await this.getFactoryContext();
    return await db.transaction(async (tx) => {
      await tx.insert(stockTransactions).values({
        materialId: dto.materialId,
        factoryId,
        type: dto.type,
        quantity: dto.quantity.toString(),
        remarks: dto.remarks,
        referenceId: dto.referenceId,
      });

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
}
