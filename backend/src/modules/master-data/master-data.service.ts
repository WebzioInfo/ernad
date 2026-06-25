import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { eq, sql, and, inArray } from 'drizzle-orm';

import { db } from '../../database/db';
import { productionLines, products, productBrands, productionBatches, rawMaterials, rawMaterialTransactions, productStockTransactions, productionStock } from '../../database/schema';
import { ProductionEventsService } from '../../realtime/production.gateway';
import { sumRawMaterialTransactions } from '../inventory/raw-material-balance.util';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MasterDataService {
  private linesCache: { data: any; expiresAt: number } | null = null;

  constructor(
    private readonly eventsService: ProductionEventsService,
    private readonly auditService: AuditService
  ) {}

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
      sql`${productionBatches.status} IN ('RUNNING', 'CHANGEOVER')`
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
      sql`${productionBatches.status} IN ('RUNNING', 'CHANGEOVER')`
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

  async createProduct(dto: { name: string; sku?: string; brandId: string; category?: string; targetBPM?: number }) {
    const [product] = await db.insert(products).values({ ...dto }).returning();
    await this.eventsService.emitDataChanged('products', { action: 'created', id: product.id });
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

  async updateProduct(user: any, id: string, dto: any) {
    const { currentStock, totalProduced, totalDispatched, ...productDto } = dto;
    const hasInventoryUpdate = currentStock !== undefined || totalProduced !== undefined || totalDispatched !== undefined;

    if (hasInventoryUpdate) {
      if (!user?.roles?.includes('ADMIN') && !user?.roles?.includes('SUPER_ADMIN')) {
        throw new ForbiddenException("You do not have permission to edit inventory.");
      }
    }

    const result = await db.transaction(async (tx) => {
      let product;
      if (Object.keys(productDto).length > 0) {
        [product] = await tx.update(products)
          .set({ ...productDto })
          .where(eq(products.id, id))
          .returning();
      } else {
        [product] = await tx.select().from(products).where(eq(products.id, id)).limit(1);
      }

      if (hasInventoryUpdate) {
        const [stockRec] = await tx.select().from(productionStock).where(eq(productionStock.productId, id)).limit(1);
        if (stockRec) {
          const updatePayload: any = { updatedAt: new Date() };

          if (currentStock !== undefined && Number(stockRec.currentStock) !== currentStock) {
            updatePayload.currentStock = String(currentStock);
            const diff = currentStock - Number(stockRec.currentStock);
            await tx.insert(productStockTransactions).values({
              productId: id,
              type: 'MANUAL_STOCK_ADJUST',
              quantityChange: String(diff),
              balanceAfter: String(currentStock),
              remarks: 'Manual Stock Adjustment',
              performedBy: user.id,
            });
          }

          if (totalProduced !== undefined && Number(stockRec.totalProduced) !== totalProduced) {
            updatePayload.totalProduced = String(totalProduced);
            const diff = totalProduced - Number(stockRec.totalProduced);
            await tx.insert(productStockTransactions).values({
              productId: id,
              type: 'MANUAL_PRODUCED_ADJUST',
              quantityChange: String(diff),
              balanceAfter: String(totalProduced),
              remarks: 'Manual Total Produced Adjustment',
              performedBy: user.id,
            });
          }

          if (totalDispatched !== undefined && Number(stockRec.totalDispatched) !== totalDispatched) {
            updatePayload.totalDispatched = String(totalDispatched);
            const diff = totalDispatched - Number(stockRec.totalDispatched);
            await tx.insert(productStockTransactions).values({
              productId: id,
              type: 'MANUAL_DISPATCH_ADJUST',
              quantityChange: String(diff),
              balanceAfter: String(totalDispatched),
              remarks: 'Manual Total Dispatched Adjustment',
              performedBy: user.id,
            });
          }

          if (Object.keys(updatePayload).length > 1) {
            await tx.update(productionStock).set(updatePayload).where(eq(productionStock.id, stockRec.id));

            await this.auditService.logAction({
              userId: user.id,
              action: `MANUAL_INVENTORY_ADJUST`,
              entityType: 'production_stock',
              entityId: stockRec.id,
              category: 'INVENTORY',
              payload: {
                productId: id,
                productName: product.name,
                previousCurrentStock: Number(stockRec.currentStock),
                newCurrentStock: currentStock !== undefined ? currentStock : Number(stockRec.currentStock),
                previousTotalProduced: Number(stockRec.totalProduced),
                newTotalProduced: totalProduced !== undefined ? totalProduced : Number(stockRec.totalProduced),
                previousTotalDispatched: Number(stockRec.totalDispatched),
                newTotalDispatched: totalDispatched !== undefined ? totalDispatched : Number(stockRec.totalDispatched),
              }
            });
          }
        }
      }
      return product;
    });

    await this.eventsService.emitDataChanged('products', { action: 'updated', id });
    if (hasInventoryUpdate) {
      await this.eventsService.emitDataChanged('inventory', { action: 'stock_transaction_created', itemId: id, itemType: 'PRODUCT' });
    }
    return result;
  }

  async deleteProduct(id: string) {
    await db.delete(products).where(eq(products.id, id));
    await this.eventsService.emitDataChanged('products', { action: 'deleted', id });
    return { success: true };
  }

  async getRawMaterials(station?: string) {
    if (station) {
      const stationMap: Record<string, string> = {
        'BLOWING': 'PREFORM',
        'FILLING': 'CAP',
        'CAPPING': 'CAP',
        'LABELING': 'LABEL',
        'PACKING': 'SHRINK'
      };
      
      const targetType = stationMap[station.toUpperCase()];
      if (targetType) {
        return await db.select({
          id: rawMaterials.id,
          name: rawMaterials.name,
          materialType: rawMaterials.materialType,
          unit: rawMaterials.unit,
          currentStock: rawMaterials.currentStock,
        })
        .from(rawMaterials)
        .where(eq(rawMaterials.materialType, targetType));
      }
    }

    return await db.select({
      id: rawMaterials.id,
      name: rawMaterials.name,
      materialType: rawMaterials.materialType,
      unit: rawMaterials.unit,
      currentStock: rawMaterials.currentStock,
    })
    .from(rawMaterials);
  }

  async createRawMaterial(dto: { name: string; materialType: string; unit: string }) {
    const [rawMaterial] = await db.insert(rawMaterials).values({ ...dto }).returning();
    await this.eventsService.emitDataChanged('inventory', { action: 'raw_material_created', id: rawMaterial.id });
    return rawMaterial;
  }

  async updateRawMaterial(id: string, dto: { name?: string; materialType?: string; unit?: string; currentStock?: number }) {
    if (dto.currentStock !== undefined) {
      const txs = await db.select({ quantityChange: rawMaterialTransactions.quantityChange })
        .from(rawMaterialTransactions)
        .where(eq(rawMaterialTransactions.materialId, id));
      
      const currentBalance = sumRawMaterialTransactions(txs);
      const difference = dto.currentStock - currentBalance;

      if (difference !== 0) {
        await db.insert(rawMaterialTransactions).values({
          materialId: id,
          type: 'EDIT',
          quantityChange: String(difference),
          balanceAfter: String(dto.currentStock),
          remarks: 'Manual Stock Adjustment via Edit',
        });
      }
    }

    const { currentStock, ...updateData } = dto;
    const dbPayload: any = { ...updateData, updatedAt: new Date() };
    if (currentStock !== undefined) dbPayload.currentStock = String(currentStock);

    const [rawMaterial] = await db.update(rawMaterials)
      .set(dbPayload)
      .where(eq(rawMaterials.id, id))
      .returning();
      
    await this.eventsService.emitDataChanged('inventory', { action: 'raw_material_updated', id });
    return rawMaterial;
  }

  async deleteRawMaterial(id: string) {
    await db.delete(rawMaterials).where(eq(rawMaterials.id, id));
    await this.eventsService.emitDataChanged('inventory', { action: 'raw_material_deleted', id });
    return { success: true };
  }
}
