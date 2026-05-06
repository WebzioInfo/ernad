import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/db';
import { attendanceLogs, users } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class EsslSyncService {
  private readonly logger = new Logger(EsslSyncService.name);

  /**
   * Parses raw data from eSSL Biometric Push Protocol.
   * Format expected: USERID,TIMESTAMP,STATUS,VERIFY_TYPE,DEVICE_ID
   */
  async processPushData(rawData: string) {
    this.logger.log(`Processing eSSL Push Data: ${rawData.slice(0, 50)}...`);
    const lines = rawData.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;
      const [externalId, timestampStr, typeStr] = line.split(',');

      if (!externalId || !timestampStr) continue;

      const timestamp = new Date(timestampStr);
      const isClockIn = typeStr === '0'; // 0: Check-In, 1: Check-Out in standard ADMS

      await this.syncAttendance(externalId, timestamp, isClockIn);
    }
  }

  private async syncAttendance(externalId: string, timestamp: Date, isClockIn: boolean) {
    const [user] = await db.select().from(users).where(eq(users.username, externalId)).limit(1);
    if (!user) {
      this.logger.warn(`No user found for External ID: ${externalId}`);
      return;
    }

    if (isClockIn) {
      // Create new attendance record
      await db.insert(attendanceLogs).values({
        userId: user.id,
        clockIn: timestamp,
        externalSyncId: externalId,
        status: 'PRESENT',
      });
    } else {
      // Update active record with clock-out
      const [activeLog] = await db.select()
        .from(attendanceLogs)
        .where(and(eq(attendanceLogs.userId, user.id), isNull(attendanceLogs.clockOut)))
        .orderBy(attendanceLogs.clockIn)
        .limit(1);

      if (activeLog) {
        await db.update(attendanceLogs)
          .set({ clockOut: timestamp })
          .where(eq(attendanceLogs.id, activeLog.id));
      }
    }
  }

  /**
   * Enterprise Safety: Auto-ClockOut logic for forgotten logs.
   * Runs daily at 04:00 AM (End of last shift cycle).
   */
  async autoClockOutForgotten() {
    this.logger.log('Starting Auto-ClockOut safety task...');
    const abandoned = await db.select()
      .from(attendanceLogs)
      .where(isNull(attendanceLogs.clockOut));

    for (const log of abandoned) {
      const autoOut = new Date(log.clockIn);
      autoOut.setHours(autoOut.getHours() + 8); // Default 8-hour shift fallback

      await db.update(attendanceLogs)
        .set({ 
          clockOut: autoOut, 
          remarks: 'Auto-ClockOut (System Safety Override)' 
        })
        .where(eq(attendanceLogs.id, log.id));
    }
    this.logger.log(`Auto-ClockOut complete. Repaired ${abandoned.length} logs.`);
  }
}
