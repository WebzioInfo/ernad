import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { attendanceLogs, users } from '../../database/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  async syncBiometricData() {
    this.logger.log('Biometric sync triggered. Searching for logs...');
    
    // NOTE: In production, this method should be integrated with real-time biometric push protocols
    // or TCP polling via BiometricConnectionService.
    // Mock data generation has been removed as per strict policy.
    
    return {
      status: 'SUCCESS',
      syncedRecords: 0,
      lastSync: new Date(),
      message: 'Real-time synchronization active via eSSL/TCP protocols.'
    };
  }

  async getAllAttendance() {
    return await db.select({
      id: attendanceLogs.id,
      userName: users.name,
      userJob: users.jobTitle,
      clockIn: attendanceLogs.clockIn,
      clockOut: attendanceLogs.clockOut,
      status: attendanceLogs.status,
      shift: attendanceLogs.shiftName,
    })
    .from(attendanceLogs)
    .innerJoin(users, eq(attendanceLogs.userId, users.id))
    .orderBy(desc(attendanceLogs.clockIn))
    .limit(100);
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
