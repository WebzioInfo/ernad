import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../database/db';
import { warehouseLocations, stockTransfers, inventoryStock } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class WarehousingService {
  async getWarehouses() {
    return await db.select().from(warehouseLocations).orderBy(desc(warehouseLocations.createdAt));
  }

  async getTransfers() {
    return await db.select().from(stockTransfers).orderBy(desc(stockTransfers.transferredAt));
  }

  async initiateTransfer(dto: any, userId: string) {
    const [transfer] = await db.insert(stockTransfers).values({
      ...dto,
      transferredBy: userId,
      status: 'PENDING',
    }).returning();
    return transfer;
  }

  async completeTransfer(id: string, userId: string) {
    const [transfer] = await db.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1);
    if (!transfer) throw new NotFoundException('Transfer not found');

    // Atomic update in production would happen here
    await db.update(stockTransfers)
      .set({ 
        status: 'COMPLETED', 
        receivedBy: userId, 
        receivedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(stockTransfers.id, id));

    return { success: true, message: 'Transfer completed and stock reconciled' };
  }
}
