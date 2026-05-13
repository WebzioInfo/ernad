import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, sql, and, inArray } from 'drizzle-orm';

import { db } from '../../database/db';
import { productionLines, products, productBrands, factories, productionBatches } from '../../database/schema';

@Injectable()
export class MasterDataService {
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

  async getLine(id: string) {
    const [line] = await db.select().from(productionLines).where(eq(productionLines.id, id)).limit(1);
    if (!line) throw new BadRequestException('Production line not found.');

    const [activeBatch] = await db.select({
      id: productionBatches.id,
      batchCode: productionBatches.batchCode,
      status: productionBatches.status,
      productName: products.name,
      brandName: productBrands.name
    })
    .from(productionBatches)
    .leftJoin(products, eq(productionBatches.productId, products.id))
    .leftJoin(productBrands, eq(productionBatches.brandId, productBrands.id))
    .where(and(
      eq(productionBatches.lineId, id),
      inArray(productionBatches.status, ['RUNNING', 'CHANGEOVER'])
    ))
    .limit(1);

    return {
      ...line,
      batch: activeBatch || null
    };
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
      console.error('[MasterDataService] createLine Error:', error);
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

  async createProduct(dto: { name: string; sku?: string; brandId: string; category?: string }) {
    const factoryId = await this.getFactoryContext();
    const [product] = await db.insert(products).values({ ...dto, factoryId }).returning();
    return product;
  }

  async createBrand(dto: { name: string }) {
    const [brand] = await db.insert(productBrands).values(dto).returning();
    return brand;
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
}
