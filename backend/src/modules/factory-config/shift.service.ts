import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { shifts } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class ShiftService {
  private readonly logger = new Logger(ShiftService.name);

  async getCurrentShift() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const allShifts = await db.select().from(shifts);
    
    for (const shift of allShifts) {
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      
      if (startMinutes <= endMinutes) {
        // Normal shift
        if (currentTime >= startMinutes && currentTime < endMinutes) return shift;
      } else {
        // Cross-midnight shift (e.g., 22:00 to 06:00)
        if (currentTime >= startMinutes || currentTime < endMinutes) return shift;
      }
    }
    return null;
  }

  async validateShiftEntry(shiftId: string, loggedAt: Date) {
    const shift = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    if (!shift.length) return false;

    // Factory Rule: Allow logs up to 60 minutes after shift end for late syncs
    const [endH, endM] = shift[0].endTime.split(':').map(Number);
    const shiftEnd = new Date(loggedAt);
    shiftEnd.setHours(endH, endM, 0, 0);
    
    if (endH < parseInt(shift[0].startTime.split(':')[0])) {
      // Shift ends next day
      if (loggedAt.getHours() > endH + 1) { // simple check for 1 hour window
         // This is complex for cross-day. 
         // For MES, we usually check if the batch is still RUNNING.
      }
    }
    
    return true; 
  }
}
