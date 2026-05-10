import { Injectable, Logger } from '@nestjs/common';
import * as ZKLib from 'node-zklib';
import { db } from '../../database/db';
import { biometricAttendanceLogs, biometricDevices, dailyAttendance, users, shifts, employeeShiftAssignments } from '../../database/schema';
import { eq, and, sql, desc, inArray, lte } from 'drizzle-orm';
import * as crypto from 'crypto';
import { format, parse, differenceInHours } from 'date-fns';

@Injectable()
export class BiometricDebugService {
  private readonly logger = new Logger('BiometricDebug');

  async debugSync(ip: string, port: number = 4370) {
    const stats = {
      deviceConnected: false,
      usersFound: 0,
      logsFetched: 0,
      inserted: 0,
      duplicates: 0,
      errors: [] as string[],
    };

    let zkInstance: any;

    try {
      this.logger.log(`[BIOMETRIC_CONNECTING] Attempting connection to ${ip}:${port}...`);
      zkInstance = new ZKLib(ip, port, 10000, 4000);
      await zkInstance.createSocket();
      stats.deviceConnected = true;
      this.logger.log(`[BIOMETRIC_CONNECTED] Successfully linked to device.`);

      // Step 1: Fetch Users
      try {
        const usersData = await zkInstance.getUsers();
        stats.usersFound = usersData.data?.length || 0;
        this.logger.log(`[BIOMETRIC_USERS_COUNT] Found ${stats.usersFound} users on device.`);
      } catch (err) {
        this.logger.warn(`Failed to fetch users: ${err.message}`);
      }

      // Step 2: Fetch Logs
      this.logger.log(`[BIOMETRIC_FETCH_START] Pulling attendance logs...`);
      const logsData = await zkInstance.getAttendances();
      const rawLogs = logsData.data || [];
      stats.logsFetched = rawLogs.length;
      this.logger.log(`[BIOMETRIC_LOGS_COUNT] Retrieved ${stats.logsFetched} raw logs.`);

      if (stats.logsFetched === 0) {
        this.logger.warn(`[BIOMETRIC_EMPTY_MEMORY] No logs found on device memory.`);
        return stats;
      }

      // Step 3: Find or Create Device in DB
      let [device] = await db.select().from(biometricDevices).where(eq(biometricDevices.ipAddress, ip));
      if (!device) {
        [device] = await db.insert(biometricDevices).values({
          name: `Diagnostic Device (${ip})`,
          ipAddress: ip,
          port: port,
          status: 'ONLINE',
        }).returning();
      }

      // Step 4: Transactional Insertion
      this.logger.log(`[BIOMETRIC_DB_INSERT_START] Beginning batch insertion...`);
      
      const affectedUserIds = new Set<string>();

      for (const log of rawLogs) {
        try {
          // normalize log time
          const punchTime = new Date(log.recordTime);
          if (isNaN(punchTime.getTime())) {
            this.logger.error(`[BIOMETRIC_INVALID_DATE] Skipping record with invalid date: ${log.recordTime}`);
            continue;
          }

          // Generate Unique Hash: SHA256(deviceUserId + punchTime + deviceId)
          const hashSource = `${log.deviceUserId}-${punchTime.toISOString()}-${device.id}`;
          const hash = crypto.createHash('sha256').update(hashSource).digest('hex');

          // Print Raw Log for debugging (first few only to avoid spam)
          if (stats.inserted < 5) {
            this.logger.debug(`[BIOMETRIC_RAW_LOG] User: ${log.deviceUserId}, Time: ${log.recordTime}, Type: ${log.ip}`);
          }

          // Insert into DB
          await db.insert(biometricAttendanceLogs).values({
            deviceId: device.id,
            deviceUserId: log.deviceUserId,
            punchTime: punchTime,
            punchType: log.ip || 0,
            rawData: log,
            uniqueHash: hash
          });

          stats.inserted++;
          affectedUserIds.add(log.deviceUserId);
          
        } catch (err) {
          if (err.message?.includes('unique constraint') || err.code === '23505') {
            stats.duplicates++;
            // Only log duplicates at debug level
            // this.logger.debug(`[BIOMETRIC_DUPLICATE_SKIPPED] User: ${log.deviceUserId}, Time: ${log.recordTime}`);
          } else {
            stats.errors.push(`Insert failed for user ${log.deviceUserId}: ${err.message}`);
            this.logger.error(`[BIOMETRIC_DB_INSERT_FAILED] ${err.message}`);
          }
        }
      }

      this.logger.log(`[BIOMETRIC_DB_INSERT_SUCCESS] Inserted: ${stats.inserted}, Duplicates: ${stats.duplicates}`);

      // Step 5: Process Attendance for affected users
      if (affectedUserIds.size > 0) {
        this.logger.log(`[BIOMETRIC_PROCESSING_START] Computing daily attendance for ${affectedUserIds.size} users...`);
        await this.processAttendanceForLogs(Array.from(affectedUserIds));
      }

    } catch (error) {
      this.logger.error(`[BIOMETRIC_CONNECTION_FAILED] ${error.message}`);
      stats.errors.push(error.message);
    } finally {
      if (zkInstance) {
        try {
          await zkInstance.disconnect();
          this.logger.log(`[BIOMETRIC_DISCONNECTED] Connection closed safely.`);
        } catch (e) {}
      }
    }

    return stats;
  }

  private async processAttendanceForLogs(deviceUserIds: string[]) {
    // Map device IDs to system users
    const systemUsers = await db.select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.username, deviceUserIds));

    for (const user of systemUsers) {
      const [assignment] = await db.select({ shiftId: employeeShiftAssignments.shiftId })
        .from(employeeShiftAssignments)
        .where(eq(employeeShiftAssignments.userId, user.id))
        .orderBy(desc(employeeShiftAssignments.effectiveFrom))
        .limit(1);

      const userShift = assignment ? (await db.select().from(shifts).where(eq(shifts.id, assignment.shiftId)))[0] : null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const punches = await db.select().from(biometricAttendanceLogs)
        .where(and(
          eq(biometricAttendanceLogs.deviceUserId, user.username),
          sql`${biometricAttendanceLogs.punchTime} >= ${thirtyDaysAgo}`
        ))
        .orderBy(desc(biometricAttendanceLogs.punchTime));

      const punchesByDate = new Map<string, Date[]>();
      punches.forEach(p => {
        const dateKey = format(p.punchTime, 'yyyy-MM-dd');
        if (!punchesByDate.has(dateKey)) punchesByDate.set(dateKey, []);
        punchesByDate.get(dateKey)!.push(p.punchTime);
      });

      for (const [date, times] of punchesByDate) {
        const sorted = times.sort((a, b) => a.getTime() - b.getTime());
        const firstIn = sorted[0];
        const lastOut = sorted.length > 1 ? sorted[sorted.length - 1] : null;
        
        let workedHours = lastOut ? (lastOut.getTime() - firstIn.getTime()) / (1000 * 60 * 60) : 0;
        let lateMinutes = 0;
        let overtimeMinutes = 0;
        let status = 'PRESENT';

        if (userShift) {
          const shiftStart = parse(`${date} ${userShift.startTime}`, 'yyyy-MM-dd HH:mm:ss', new Date());
          const shiftEnd = parse(`${date} ${userShift.endTime}`, 'yyyy-MM-dd HH:mm:ss', new Date());
          const graceThreshold = new Date(shiftStart.getTime() + userShift.graceMinutes * 60000);
          
          if (firstIn > graceThreshold) {
            lateMinutes = Math.max(0, Math.round((firstIn.getTime() - shiftStart.getTime()) / 60000));
            status = 'LATE';
          }

          if (lastOut && userShift.overtimeAfter > 0) {
            const otThreshold = new Date(shiftEnd.getTime() + userShift.overtimeAfter * 60000);
            if (lastOut > otThreshold) {
              overtimeMinutes = Math.max(0, Math.round((lastOut.getTime() - shiftEnd.getTime()) / 60000));
            }
          }
        }

        if (workedHours > 0 && workedHours < (userShift?.minimumHours || 4)) status = 'HALF_DAY';
        if (workedHours === 0 && firstIn) status = 'CHECKED_IN';

        await db.insert(dailyAttendance).values({
          userId: user.id,
          date,
          shiftId: userShift?.id,
          checkIn: firstIn,
          checkOut: lastOut,
          workedHours: workedHours.toFixed(2),
          status,
          lateMinutes,
          overtimeMinutes,
          updatedAt: new Date()
        }).onConflictDoUpdate({
          target: [dailyAttendance.userId, dailyAttendance.date],
          set: {
            shiftId: userShift?.id,
            checkIn: firstIn,
            checkOut: lastOut,
            workedHours: workedHours.toFixed(2),
            status,
            lateMinutes,
            overtimeMinutes,
            updatedAt: new Date()
          }
        });
      }
    }
  }
}
