import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../database/db';
import { customers, salesOrders, salesOrderItems } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class SalesService {
  async getCustomers() {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getOrders() {
    return await db.select().from(salesOrders).orderBy(desc(salesOrders.orderDate));
  }

  async getOrderById(id: string) {
    const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!order) throw new NotFoundException('Sales order not found');

    const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, id));

    return { ...order, items };
  }

  async createOrder(dto: any, userId: string) {
    // Basic implementation for now
    const [order] = await db.insert(salesOrders).values({
      ...dto,
      createdBy: userId,
    }).returning();
    return order;
  }

  async updateOrderStatus(id: string, status: any) {
    const [order] = await db.update(salesOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(salesOrders.id, id))
      .returning();
    return order;
  }
}
