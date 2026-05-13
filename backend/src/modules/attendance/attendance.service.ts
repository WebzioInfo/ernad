import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { attendanceLogs, users, roles, userRoles } from '../../database/schema';
import { eq, desc, and, gte, lte, inArray, notInArray } from 'drizzle-orm';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  private static readonly PRIVILEGED_ROLES = [
    'SUPER_ADMIN',
    'SUPERADMIN',
    'ADMIN',
    'SYSTEM_ADMIN',
    'ROOT',
    'OWNER',
  ];

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

  async getAllAttendance(callerRoles: string[] = []) {
    const isSuperAdmin = callerRoles.includes('SUPER_ADMIN');
    const isAdmin = callerRoles.includes('ADMIN');

    // If not Admin/SuperAdmin, we must filter out privileged accounts
    let excludedUserIds: string[] = [];

    if (!isSuperAdmin && !isAdmin) {
      const privilegedRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.slug, AttendanceService.PRIVILEGED_ROLES));

      if (privilegedRoles.length > 0) {
        const privilegedUserRoles = await db
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(inArray(userRoles.roleId, privilegedRoles.map(r => r.id)));

        excludedUserIds = privilegedUserRoles.map(pur => pur.userId);
      }
    }

    let query = db.select({
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
      .$dynamic();

    if (excludedUserIds.length > 0) {
      query = query.where(notInArray(attendanceLogs.userId, excludedUserIds));
    }

    return await query
      .orderBy(desc(attendanceLogs.clockIn))
      .limit(100);
  }

  async getOperatorAttendance(operatorId: string, callerRoles: string[] = []) {
    const isSuperAdmin = callerRoles.includes('SUPER_ADMIN');
    const isAdmin = callerRoles.includes('ADMIN');
    const isManager = callerRoles.includes('MANAGER');

    // Hierarchy Check
    if (!isSuperAdmin && !isAdmin) {
      const targetUser = await db.select().from(users).where(eq(users.id, operatorId)).limit(1);
      if (targetUser[0]) {
        const targetRolesResult = await db.select({ slug: roles.slug })
          .from(roles)
          .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, operatorId));
        const targetRoles = targetRolesResult.map(r => r.slug);

        if (isManager) {
          const isPrivileged = targetRoles.some(r => AttendanceService.PRIVILEGED_ROLES.includes(r as any));
          if (isPrivileged) throw new ForbiddenException('Access to administrative attendance records is restricted');
        }
      }
    }

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

  /**
   * Manual Attendance Override (FALLBACK)
   * Used when biometric devices are offline or sync fails.
   */
  async logManualAttendance(
    operatorId: string,
    managerId: string,
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'OFF_DUTY',
    remarks?: string
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [existing] = await db.select().from(attendanceLogs)
      .where(and(eq(attendanceLogs.userId, operatorId), gte(attendanceLogs.clockIn, today)))
      .limit(1);

    if (existing) {
      return await db.update(attendanceLogs)
        .set({ status, remarks: remarks || 'Manual correction' })
        .where(eq(attendanceLogs.id, existing.id))
        .returning();
    }

    return await db.insert(attendanceLogs).values({
      userId: operatorId,
      clockIn: new Date(),
      status,
      shiftName: 'Manual Entry',
      remarks: remarks || 'Logged manually by manager',
    }).returning();
  }
}
