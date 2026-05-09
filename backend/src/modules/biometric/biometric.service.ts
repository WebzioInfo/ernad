import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database/db';
import { 
  biometricDevices, 
  biometricAttendanceLogs, 
  dailyAttendance,
  users,
  shifts,
  employeeShiftAssignments
} from '../../database/schema';
import { eq, and, sql, desc, inArray, lte, or, isNull } from 'drizzle-orm';
import * as crypto from 'crypto';
import { BiometricConnectionService } from './biometric-connection.service';
import { format, startOfDay, endOfDay, differenceInHours, parse, addDays } from 'date-fns';

@Injectable()
export class BiometricService {
  private readonly logger = new Logger(BiometricService.name);

  constructor(private readonly connectionService: BiometricConnectionService) {}

  // --- Device Management ---
  async getDevices() {
    return await db.select().from(biometricDevices).orderBy(desc(biometricDevices.createdAt));
  }

  async createDevice(dto: any) {
    const [device] = await db.insert(biometricDevices).values(dto).returning();
    return device;
  }

  async updateDevice(id: string, dto: any) {
    const [device] = await db.update(biometricDevices)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(biometricDevices.id, id))
      .returning();
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async testConnection(deviceId: string) {
    const [device] = await db.select().from(biometricDevices).where(eq(biometricDevices.id, deviceId));
    if (!device) throw new NotFoundException('Device not found');

    const isAlive = await this.connectionService.pingDevice(device.ipAddress, device.port);
    
    await db.update(biometricDevices).set({ 
      status: isAlive ? 'ONLINE' : 'OFFLINE', 
      lastConnectedAt: isAlive ? new Date() : undefined,
      updatedAt: new Date()
    }).where(eq(biometricDevices.id, deviceId));

    return { success: isAlive, message: isAlive ? 'Biometric device reachable.' : 'Device offline.' };
  }

  // --- Shift Management ---
  async getShifts() {
    return await db.select().from(shifts).where(eq(shifts.isActive, true));
  }

  async createShift(dto: any) {
    const [shift] = await db.insert(shifts).values(dto).returning();
    return shift;
  }

  async assignShift(dto: any) {
    const [assignment] = await db.insert(employeeShiftAssignments).values({
      userId: dto.userId,
      shiftId: dto.shiftId,
      effectiveFrom: dto.effectiveFrom
    }).returning();
    return assignment;
  }

  // --- Sync & Processing ---
  async syncLogs(deviceId: string) {
    const [device] = await db.select().from(biometricDevices).where(eq(biometricDevices.id, deviceId));
    if (!device || !device.isActive) return { success: false, message: 'Device inactive' };

    const rawLogs = await this.connectionService.fetchAttendances(device.ipAddress, device.port);
    if (!rawLogs.length) return { success: true, imported: 0, skipped: 0 };

    let importedCount = 0;
    let skippedCount = 0;
    const affectedUserIds = new Set<string>();

    for (const log of rawLogs) {
      const hash = crypto.createHash('sha256').update(`${deviceId}-${log.deviceUserId}-${log.recordTime}`).digest('hex');
      try {
        await db.insert(biometricAttendanceLogs).values({
          deviceId, deviceUserId: log.deviceUserId, punchTime: new Date(log.recordTime),
          punchType: log.ip || 0, rawData: log, uniqueHash: hash
        });
        importedCount++;
        affectedUserIds.add(log.deviceUserId);
      } catch (err) { skippedCount++; }
    }

    await db.update(biometricDevices).set({ lastSyncAt: new Date(), status: 'ONLINE', updatedAt: new Date() }).where(eq(biometricDevices.id, deviceId));
    if (affectedUserIds.size > 0) await this.processAttendanceForLogs(Array.from(affectedUserIds));

    return { success: true, imported: importedCount, skipped: skippedCount };
  }

  async processAttendanceForLogs(deviceUserIds: string[]) {
    if (!deviceUserIds.length) return;

    const systemUsers = await db.select({ id: users.id, username: users.username })
      .from(users).where(inArray(users.username, deviceUserIds));

    for (const user of systemUsers) {
      // Get latest shift assignment for the user
      const [assignment] = await db.select({ shiftId: employeeShiftAssignments.shiftId })
        .from(employeeShiftAssignments)
        .where(eq(employeeShiftAssignments.userId, user.id))
        .orderBy(desc(employeeShiftAssignments.effectiveFrom))
        .limit(1);

      const userShift = assignment ? (await db.select().from(shifts).where(eq(shifts.id, assignment.shiftId)))[0] : null;

      const punches = await db.select().from(biometricAttendanceLogs)
        .where(eq(biometricAttendanceLogs.deviceUserId, user.username))
        .orderBy(desc(biometricAttendanceLogs.punchTime)).limit(200);

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
        let workedHours = lastOut ? Math.abs(differenceInHours(lastOut, firstIn)) : 0;

        // Shift Intelligence
        let lateMinutes = 0;
        let overtimeMinutes = 0;
        let status = 'PRESENT';

        if (userShift) {
          const shiftStartTime = parse(`${date} ${userShift.startTime}`, 'yyyy-MM-dd HH:mm:ss', new Date());
          const graceThreshold = new Date(shiftStartTime.getTime() + userShift.graceMinutes * 60000);
          
          if (firstIn > graceThreshold) {
            lateMinutes = Math.round((firstIn.getTime() - shiftStartTime.getTime()) / 60000);
            status = 'LATE';
          }

          if (lastOut && userShift.overtimeAfter > 0) {
            const shiftEndTime = parse(`${date} ${userShift.endTime}`, 'yyyy-MM-dd HH:mm:ss', new Date());
            const otStartThreshold = new Date(shiftEndTime.getTime() + userShift.overtimeAfter * 60000);
            if (lastOut > otStartThreshold) {
              overtimeMinutes = Math.round((lastOut.getTime() - shiftEndTime.getTime()) / 60000);
            }
          }
        }

        if (workedHours < (userShift?.minimumHours || 4) && workedHours > 0) status = 'HALF_DAY';
        if (workedHours === 0) status = 'CHECKED_IN';

        await db.insert(dailyAttendance).values({
          userId: user.id, date, shiftId: userShift?.id, checkIn: firstIn, checkOut: lastOut,
          workedHours: String(workedHours.toFixed(2)), status, lateMinutes, overtimeMinutes, updatedAt: new Date()
        }).onConflictDoUpdate({
          target: [dailyAttendance.userId, dailyAttendance.date],
          set: { shiftId: userShift?.id, checkIn: firstIn, checkOut: lastOut, workedHours: String(workedHours.toFixed(2)), status, lateMinutes, overtimeMinutes, updatedAt: new Date() }
        });
      }
    }
  }

  // --- Admin Queries ---
  async mapUser(deviceUserId: string, userId: string) {
    await db.update(users).set({ username: deviceUserId }).where(eq(users.id, userId));
    await this.processAttendanceForLogs([deviceUserId]);
    return { success: true };
  }

  async getLogs(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    return await db.execute(sql`
      SELECT l.*, u.name as "employeeName", u.username as "employeeCode"
      FROM ${biometricAttendanceLogs} l LEFT JOIN ${users} u ON l.device_user_id = u.username
      ORDER BY l.punch_time DESC LIMIT ${limit} OFFSET ${offset}
    `);
  }

  async getUnmappedLogs() {
    return await db.execute(sql`
      SELECT l.device_user_id as "deviceUserId", COUNT(l.id) as "punchCount", MAX(l.punch_time) as "lastPunch"
      FROM ${biometricAttendanceLogs} l LEFT JOIN ${users} u ON l.device_user_id = u.username
      WHERE u.id IS NULL GROUP BY l.device_user_id ORDER BY "lastPunch" DESC
    `);
  }

  async getTodayAttendance() {
    const today = format(new Date(), 'yyyy-MM-dd');
    return await db.execute(sql`
      SELECT a.*, u.name as "userName", u.username as "userCode", s.name as "shiftName"
      FROM ${dailyAttendance} a JOIN ${users} u ON a.user_id = u.id LEFT JOIN ${shifts} s ON a.shift_id = s.id
      WHERE a.date = ${today}
    `);
  }
}
