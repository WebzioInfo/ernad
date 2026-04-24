import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/db';
import { attendanceLogs, users } from '../db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  /**
   * Stub for integrating with a physical biometric API (e.g., ZKTeco, Hikvision)
   */
  async syncBiometricData() {
    this.logger.log('Fetching data from Biometric API...');
    
    // In a real scenario, this would loop through biometric device logs
    // and upsert them into attendanceLogs.
    
    return {
      status: 'SUCCESS',
      syncedRecords: 12,
      lastSync: new Date()
    };
  }

  async getOperatorAttendance(operatorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const log = await db.select()
      .from(attendanceLogs)
      .where(and(
        eq(attendanceLogs.userId, operatorId),
        gte(attendanceLogs.clockIn, today)
      ))
      .orderBy(desc(attendanceLogs.clockIn))
      .limit(1);

    if (!log.length) {
      return { 
        present: false,
        message: 'No record for today'
      };
    }

    return {
      present: true,
      clockIn: log[0].clockIn,
      shift: log[0].shiftName || 'Day Shift',
      status: log[0].status
    };
  }
}
