import { Injectable } from '@nestjs/common';
import { db } from '../../database/db';
import { shifts } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class ShiftService {
  private shiftsCache: { data: any; expiresAt: number } | null = null;

  async getShifts() {
    const now = Date.now();
    if (this.shiftsCache && this.shiftsCache.expiresAt > now) {
      return this.shiftsCache.data;
    }

    const data = await db.select().from(shifts).orderBy(shifts.name);
    this.shiftsCache = { data, expiresAt: now + 10000 };
    return data;
  }

  async createShift(dto: { name: string; startTime: string; endTime: string }) {
    this.shiftsCache = null;
    const [shift] = await db.insert(shifts).values(dto).returning();
    return shift;
  }

  async validateShiftEntry(shiftId: string, loggedAt: Date) {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    return Boolean(shift);
  }
}
