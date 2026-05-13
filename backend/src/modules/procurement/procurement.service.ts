import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../database/db';
import { vendors, purchaseOrders, goodsReceipts } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class ProcurementService {
  async getVendors() {
    return await db.select().from(vendors).orderBy(desc(vendors.createdAt));
  }

  async getPurchaseOrders() {
    return await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.orderDate));
  }

  async getGoodsReceipts() {
    return await db.select().from(goodsReceipts).orderBy(desc(goodsReceipts.receivedDate));
  }

  async createVendor(dto: any) {
    const [vendor] = await db.insert(vendors).values(dto).returning();
    return vendor;
  }

  async createPurchaseOrder(dto: any, userId: string) {
    const [po] = await db.insert(purchaseOrders).values({
      ...dto,
      createdBy: userId,
    }).returning();
    return po;
  }

  async createGoodsReceipt(dto: any, userId: string) {
    const [grn] = await db.insert(goodsReceipts).values({
      ...dto,
      receivedBy: userId,
    }).returning();
    return grn;
  }
}
