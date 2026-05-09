import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { dailyAttendance, monthlyAttendanceSummaries, users, leaveRequests } from '../../database/schema';
import { eq, and, or, sql, desc, between, lte, gte } from 'drizzle-orm';
import { format, endOfMonth } from 'date-fns';

@Injectable()
export class PayrollAttendanceService {
  private readonly logger = new Logger(PayrollAttendanceService.name);

  async aggregateMonthlyAttendance(userId: string, month: number, year: number) {
    const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

    this.logger.log(`[PAYROLL_AGGREGATION] Processing month ${month}/${year} for user ${userId}`);

    // Get all attendance for the month
    const records = await db.select()
      .from(dailyAttendance)
      .where(
        and(
          eq(dailyAttendance.userId, userId),
          between(dailyAttendance.date, startDate, endDate)
        )
      );

    // Get all approved leaves for the month
    const leaves = await db.select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.userId, userId),
          eq(leaveRequests.status, 'APPROVED'),
          or(
            between(leaveRequests.startDate, startDate, endDate),
            between(leaveRequests.endDate, startDate, endDate),
            and(lte(leaveRequests.startDate, startDate), gte(leaveRequests.endDate, endDate))
          )
        )
      );

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalHalfDays = 0;
    let totalLates = 0;
    let totalLeaveDays = 0;
    let totalOvertimeMinutes = 0;

    // Build map for quick check
    const attendanceMap = new Map(records.map(r => [r.date, r]));

    // Iterate through all days of the month to handle absences and leaves accurately
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
       const dateKey = format(new Date(year, month - 1, d), 'yyyy-MM-dd');
       const rec = attendanceMap.get(dateKey);

       // Check if date falls in any approved leave
       const isOnLeave = leaves.some(l => dateKey >= l.startDate && dateKey <= l.endDate);

       if (rec) {
         if (rec.status === 'PRESENT' || rec.status === 'LATE') totalPresent++;
         if (rec.status === 'HALF_DAY') totalHalfDays++;
         if (rec.status === 'LATE') totalLates++;
         totalOvertimeMinutes += rec.overtimeMinutes || 0;
       } else if (isOnLeave) {
         totalLeaveDays++;
       } else {
         // Future improvement: Exclude weekends/holidays from totalAbsent
         totalAbsent++;
       }
    }

    const netPayableDays = totalPresent + totalLeaveDays + (totalHalfDays * 0.5);

    const [summary] = await db.insert(monthlyAttendanceSummaries).values({
      userId,
      month,
      year,
      totalPresent,
      totalAbsent,
      totalHalfDays,
      totalLates,
      totalOvertimeMinutes,
      netPayableDays: String(netPayableDays.toFixed(1)),
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [monthlyAttendanceSummaries.userId, monthlyAttendanceSummaries.month, monthlyAttendanceSummaries.year],
      set: {
        totalPresent,
        totalAbsent,
        totalHalfDays,
        totalLates,
        totalOvertimeMinutes,
        netPayableDays: String(netPayableDays.toFixed(1)),
        updatedAt: new Date()
      }
    }).returning();

    return summary;
  }

  async getMonthlyReport(month: number, year: number) {
    return await db.execute(sql`
      SELECT 
        s.*,
        u.name as "userName",
        u.username as "userCode",
        u.department
      FROM ${monthlyAttendanceSummaries} s
      JOIN ${users} u ON s.user_id = u.id
      WHERE s.month = ${month} AND s.year = ${year}
      ORDER BY u.department, u.name
    `);
  }
}
