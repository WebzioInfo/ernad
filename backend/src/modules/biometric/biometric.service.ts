import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { db } from '../../database/db';
import {
  biometricDevices,
  biometricAttendanceLogs,
  dailyAttendance,
  users,
  shifts,
  employeeShiftAssignments,
  userRoles,
  roles
} from '../../database/schema';
import { eq, and, sql, desc, inArray, lte, or, isNull } from 'drizzle-orm';
import * as crypto from 'crypto';
import { BiometricConnectionService } from './biometric-connection.service';
import { format, startOfDay, endOfDay, differenceInHours, parse, addDays } from 'date-fns';

@Injectable()
export class BiometricService {
  private readonly logger = new Logger(BiometricService.name);

  constructor(private readonly connectionService: BiometricConnectionService) { }

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
    if (!device || !device.isActive) return { success: false, message: 'Device inactive or not found' };

    try {
      this.logger.log(`[BIOMETRIC_SYNC] Starting sync for ${device.name} (${device.ipAddress})`);
      const rawLogs = await this.connectionService.fetchAttendances(device.ipAddress, device.port);

      if (!rawLogs || !rawLogs.length) {
        await db.update(biometricDevices).set({
          lastSyncAt: new Date(),
          status: 'ONLINE',
          updatedAt: new Date()
        }).where(eq(biometricDevices.id, deviceId));
        return { success: true, imported: 0, skipped: 0 };
      }

      let importedCount = 0;
      let skippedCount = 0;
      const affectedDeviceUserIds = new Set<string>();

      this.logger.log(`[BIOMETRIC_DB_INSERT_START] Processing ${rawLogs.length} records...`);

      for (const log of rawLogs) {
        try {
          const punchTime = new Date(log.recordTime);
          if (isNaN(punchTime.getTime())) continue;

          // HASH: SHA256(deviceUserId + punchTime + deviceId)
          const hashSource = `${log.deviceUserId}-${punchTime.toISOString()}-${device.id}`;
          const hash = crypto.createHash('sha256').update(hashSource).digest('hex');

          await db.insert(biometricAttendanceLogs).values({
            deviceId,
            deviceUserId: log.deviceUserId,
            punchTime,
            punchType: log.ip || 0,
            rawData: log,
            uniqueHash: hash
          });

          importedCount++;
          affectedDeviceUserIds.add(log.deviceUserId);
        } catch (err) {
          if (err.message?.includes('unique constraint') || err.code === '23505') {
            skippedCount++;
          } else {
            this.logger.error(`[BIOMETRIC_DB_INSERT_FAILED] User ${log.deviceUserId}: ${err.message}`);
          }
        }
      }

      await db.update(biometricDevices).set({
        lastSyncAt: new Date(),
        status: 'ONLINE',
        updatedAt: new Date()
      }).where(eq(biometricDevices.id, deviceId));

      if (affectedDeviceUserIds.size > 0) {
        this.logger.log(`[BIOMETRIC_DB_INSERT_SUCCESS] Imported ${importedCount} logs. Triggering attendance computation...`);
        await this.processAttendanceForLogs(Array.from(affectedDeviceUserIds));
      }

      return { success: true, imported: importedCount, skipped: skippedCount };
    } catch (error) {
      this.logger.error(`[BIOMETRIC_SYNC_ERROR] ${error.message}`);
      await db.update(biometricDevices).set({ status: 'OFFLINE', updatedAt: new Date() }).where(eq(biometricDevices.id, deviceId));
      throw error;
    }
  }

  async syncAllDevices() {
    const activeDevices = await db.select().from(biometricDevices).where(eq(biometricDevices.isActive, true));
    const results = [];

    for (const device of activeDevices) {
      try {
        const res = await this.syncLogs(device.id);
        results.push({ deviceId: device.id, name: device.name, ...res });
      } catch (err) {
        results.push({ deviceId: device.id, name: device.name, success: false, error: err.message });
      }
    }
    return results;
  }

  async processAttendanceForLogs(deviceUserIds: string[]) {
    if (!deviceUserIds.length) return;

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

  // --- Admin Queries ---
  async mapUser(deviceUserId: string, userId: string, actorRoles: string[] = []) {
    const isSuperAdmin = actorRoles.includes('SUPER_ADMIN');
    const isAdmin = actorRoles.includes('ADMIN');
    const isManager = actorRoles.includes('MANAGER');

    // Hierarchy Check
    if (!isSuperAdmin && !isAdmin) {
      const targetUserResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (targetUserResult[0]) {
        const targetRolesResult = await db.select({ slug: roles.slug })
          .from(roles)
          .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, userId));
        const targetRoles = targetRolesResult.map(r => r.slug);

        if (isManager) {
          const isPrivileged = targetRoles.some(r => ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(r));
          if (isPrivileged) throw new ForbiddenException('Managers cannot modify administrative identity mappings');
        }
      }
    }

    await db.update(users).set({ username: deviceUserId }).where(eq(users.id, userId));
    await this.processAttendanceForLogs([deviceUserId]);
    return { success: true };
  }

  async getLogs(page = 1, limit = 50, callerRoles: string[] = []) {
    const isSuperAdmin = callerRoles.includes('SUPER_ADMIN');
    const isAdmin = callerRoles.includes('ADMIN');
    const offset = (page - 1) * limit;

    let exclusionClause = sql`1=1`;
    if (!isSuperAdmin && !isAdmin) {
      // Exclude users who have privileged roles
      exclusionClause = sql`u.id NOT IN (
        SELECT ur.user_id 
        FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE r.slug IN ('SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'ROOT', 'OWNER')
      )`;
    }

    return await db.execute(sql`
      SELECT l.*, u.name as "employeeName", u.username as "employeeCode"
      FROM ${biometricAttendanceLogs} l 
      LEFT JOIN ${users} u ON l.device_user_id = u.username
      WHERE ${exclusionClause}
      ORDER BY l.punch_time DESC 
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  async getUnmappedLogs() {
    return await db.execute(sql`
      SELECT l.device_user_id as "deviceUserId", COUNT(l.id) as "punchCount", MAX(l.punch_time) as "lastPunch"
      FROM ${biometricAttendanceLogs} l 
      LEFT JOIN ${users} u ON l.device_user_id = u.username
      WHERE u.id IS NULL 
      GROUP BY l.device_user_id 
      ORDER BY "lastPunch" DESC
    `);
  }

  async getTodayAttendance(callerRoles: string[] = []) {
    const isSuperAdmin = callerRoles.includes('SUPER_ADMIN');
    const isAdmin = callerRoles.includes('ADMIN');
    const today = format(new Date(), 'yyyy-MM-dd');

    let exclusionClause = sql`1=1`;
    if (!isSuperAdmin && !isAdmin) {
      exclusionClause = sql`u.id NOT IN (
        SELECT ur.user_id 
        FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE r.slug IN ('SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMIN', 'ROOT', 'OWNER')
      )`;
    }

    return await db.execute(sql`
      SELECT a.*, u.name as "userName", u.username as "userCode", s.name as "shiftName"
      FROM ${dailyAttendance} a 
      JOIN ${users} u ON a.user_id = u.id 
      LEFT JOIN ${shifts} s ON a.shift_id = s.id
      WHERE a.date = ${today} AND ${exclusionClause}
    `);
  }
}
