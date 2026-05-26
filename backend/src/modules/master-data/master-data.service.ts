import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, sql, and, inArray } from 'drizzle-orm';

import { db } from '../../database/db';
import { productionLines, products, productBrands, productionBatches, rawMaterials, materialCategories } from '../../database/schema';

@Injectable()
export class MasterDataService {
  private linesCache: { data: any; expiresAt: number } | null = null;

  async getLines() {
    const now = Date.now();
    if (this.linesCache && this.linesCache.expiresAt > now) {
      return this.linesCache.data;
    }
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
    .leftJoin(productBrands, eq(productionBatches.brandId, productBrands.id));

    const mappedResults = results.map(r => ({
      ...r.line,
      batch: r.batch.id ? r.batch : null
    }));

    this.linesCache = { data: mappedResults, expiresAt: now + 5000 };
    return mappedResults;
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
    this.linesCache = null;
    try {
      const [line] = await db.insert(productionLines).values({
        name: dto.name,
        description: dto.description,
        status: 'IDLE',
      }).returning();
      return line;
    } catch (error) {
      console.error('[MasterDataService] createLine Error:', error);
      throw error;
    }
  }

  async updateLine(id: string, dto: { name?: string; description?: string; status?: string }) {
    this.linesCache = null;
    const [line] = await db.update(productionLines)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(productionLines.id, id))
      .returning();
    return line;
  }

  async deleteLine(id: string) {
    this.linesCache = null;
    await db.delete(productionLines).where(eq(productionLines.id, id));
    return { success: true };
  }

  async getProducts() {
    return await db.select().from(products);
  }

  async getBrands() {
    return await db.select().from(productBrands);
  }

  async createProduct(dto: { name: string; sku?: string; brandId: string; category?: string }) {
    const [product] = await db.insert(products).values({ ...dto }).returning();
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

  async getRawMaterials() {
    return await db.select({
      id: rawMaterials.id,
      name: rawMaterials.name,
      categoryId: rawMaterials.categoryId,
      categoryName: materialCategories.name,
    })
    .from(rawMaterials)
    .innerJoin(materialCategories, eq(rawMaterials.categoryId, materialCategories.id));
  }
}
