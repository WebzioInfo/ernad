import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { operatorSessions, productionBatches, users as usersTable, terminals } from '../../database/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { RedisService } from '../../providers/redis/redis.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OperatorSessionsService {
  private readonly logger = new Logger(OperatorSessionsService.name);
  constructor(
    private readonly redis: RedisService,
    private readonly auditService: AuditService
  ) {}

  async getTerminalById(id: string) {
    const [terminal] = await db.select().from(terminals).where(eq(terminals.id, id)).limit(1);
    return terminal;
  }

  async startSession(userId: string, lineId: string, station: string, shiftId?: string, force = false, terminalId?: string, supervisorId?: string) {
    this.logger.log(`[SESSION_TRACE] Operator Login/Start. User: ${userId}, Line: ${lineId}, Station: ${station}`);

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId) || !uuidRegex.test(lineId)) {
      throw new BadRequestException('Invalid User ID or Line ID format.');
    }

    // Close operator's other active sessions (to keep getCurrentSession consistent)
    await db.update(operatorSessions)
      .set({ isActive: false, endTime: new Date(), endedBy: userId, endReason: 'switched_station' })
      .where(and(eq(operatorSessions.userId, userId), eq(operatorSessions.isActive, true)));

    // Bind to active batch
    const [activeBatch] = await db.select().from(productionBatches)
      .where(and(eq(productionBatches.lineId, lineId), eq(productionBatches.status, 'RUNNING')))
      .limit(1);

    // Determine Factory
    const factoryId = activeBatch?.factoryId || (await db.select({ f: usersTable.factoryId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0]?.f;

    // Create Session
    const [session] = await db.insert(operatorSessions).values({
      userId,
      lineId,
      station,
      batchId: activeBatch?.id || null,
      shiftId: shiftId || null,
      factoryId: factoryId,
      terminalId: terminalId || null,
      isActive: true,
      startTime: new Date()
    }).returning();

    // Log LOGIN event to audit log
    await this.auditService.logAction({
      userId,
      action: 'LOGIN',
      category: 'AUTH',
      payload: {
        terminalId,
        machineId: lineId,
        station
      }
    });

    // Invalidate Cache
    if (this.redis.getAvailability()) {
      this.redis.del(`operator_session:${userId}`).catch(() => {});
    }

    return session;
  }

  async endSession(userId: string, endedBy?: string, reason = 'manual') {
    const [active] = await db.select().from(operatorSessions)
      .where(and(eq(operatorSessions.userId, userId), eq(operatorSessions.isActive, true)))
      .limit(1);

    if (!active) return null;

    const [session] = await db.update(operatorSessions)
      .set({ isActive: false, endTime: new Date(), endedBy: endedBy || userId, endReason: reason })
      .where(eq(operatorSessions.id, active.id))
      .returning();

    // Log LOGOUT event to audit log
    await this.auditService.logAction({
      userId,
      action: 'LOGOUT',
      category: 'AUTH',
      payload: {
        terminalId: session.terminalId,
        reason
      }
    });

    // Invalidate Cache
    if (this.redis.getAvailability()) {
      this.redis.del(`operator_session:${userId}`).catch(() => {});
    }

    return session;
  }

  async getCurrentSession(userId: string) {
    if (this.redis.getAvailability()) {
      try {
        const cached = await this.redis.get(`operator_session:${userId}`);
        if (cached) return JSON.parse(cached);
      } catch {
        // Silently fail to DB
      }
    }

    const [session] = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.userId, userId),
        eq(operatorSessions.isActive, true)
      ))
      .limit(1);

    if (session && this.redis.getAvailability()) {
      this.redis.set(`operator_session:${userId}`, JSON.stringify(session), 'EX', 3600 * 12).catch(() => {});
    }

    return session || null;
  }

  async getRecentSessions(userId: string) {
    // Deprecated session history query, return empty list to prevent DB load
    return [];
  }

  async getAllActiveSessions() {
    // Deprecated session listing, return empty list
    return [];
  }

  async heartbeat(userId: string) {
    // Deprecated: Session heartbeats are no longer tracked
    return;
  }

  async cleanupStaleSessions() {
    // Deprecated: Session timeout cleanups are no longer tracked
    return 0;
  }
}
