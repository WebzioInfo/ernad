import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { db } from '../db/db';
import { productionLines, shifts, products, productBrands } from '../db/schema';

@Injectable()
export class MasterDataService {
  async getLines() {
    return await db.select().from(productionLines);
  }

  async createLine(dto: { name: string; description?: string }) {
    const [line] = await db.insert(productionLines).values({
      name: dto.name,
      description: dto.description,
      status: 'IDLE',
    }).returning();
    return line;
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
}
