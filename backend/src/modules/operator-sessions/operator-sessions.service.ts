import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { operatorSessions, productionBatches, users as usersTable, terminals, productionLines } from '../../database/schema';
import { eq, and, desc, isNull, or } from 'drizzle-orm';
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

    // Validate Line is active (RUNNING or CHANGEOVER)
    const [line] = await db.select({ status: productionLines.status }).from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
    if (!line) {
      throw new BadRequestException('Production line not found.');
    }
    if (line.status !== 'RUNNING' && line.status !== 'CHANGEOVER') {
      throw new BadRequestException('Line is not active for operator session');
    }

    const permittedStations = ['BLOWING', 'FILLING', 'LABELING', 'PACKING', 'QC', 'GENERAL'];
    if (!permittedStations.includes(station.toUpperCase())) {
      throw new BadRequestException(`Invalid station: ${station}`);
    }

    // Idempotent reuse: if active session exists on this station, reuse it
    const [existingActive] = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.userId, userId),
        eq(operatorSessions.lineId, lineId),
        eq(operatorSessions.station, station),
        eq(operatorSessions.isActive, true)
      ))
      .limit(1);

    if (existingActive) {
      this.logger.log(`[SESSION_TRACE] Active session already exists for User: ${userId}, Line: ${lineId}, Station: ${station}. Reusing.`);
      return existingActive;
    }

    // Check if another user has an active session on this line and station
    const [activeOccupant] = await db.select({
      id: operatorSessions.id,
      userId: operatorSessions.userId
    }).from(operatorSessions)
      .where(and(
        eq(operatorSessions.lineId, lineId),
        eq(operatorSessions.station, station),
        eq(operatorSessions.isActive, true)
      ))
      .limit(1);

    if (activeOccupant && activeOccupant.userId !== userId) {
      if (!force || !supervisorId) {
        throw new BadRequestException({
          message: 'This station is currently occupied by another operator. Supervisor override required.',
          code: 'SUPERVISOR_OVERRIDE_REQUIRED',
          ownerId: activeOccupant.userId
        });
      }
      // If force is true and we have supervisor override, close the active occupant's session
      await db.update(operatorSessions)
        .set({
          isActive: false,
          endTime: new Date(),
          endedBy: supervisorId,
          endReason: 'supervisor_takeover'
        })
        .where(eq(operatorSessions.id, activeOccupant.id));
    }

    // Close operator's other active sessions (to keep getCurrentSession consistent)
    await db.update(operatorSessions)
      .set({ isActive: false, endTime: new Date(), endedBy: userId, endReason: 'switched_station' })
      .where(and(eq(operatorSessions.userId, userId), eq(operatorSessions.isActive, true)));

    // Bind to active batch (Global)
    const [activeBatch] = await db.select().from(productionBatches)
      .where(or(eq(productionBatches.status, 'RUNNING'), eq(productionBatches.status, 'CHANGEOVER')))
      .orderBy(desc(productionBatches.startTime))
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

  async changeStation(userId: string, newStation: string) {
    const permittedStations = ['BLOWING', 'FILLING', 'LABELING', 'PACKING', 'QC', 'GENERAL'];
    if (!permittedStations.includes(newStation.toUpperCase())) {
      throw new BadRequestException(`Invalid station: ${newStation}`);
    }

    // Get the current active session
    const [activeSession] = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.userId, userId),
        eq(operatorSessions.isActive, true)
      ))
      .limit(1);

    if (!activeSession) {
      throw new BadRequestException('No active session found to change station.');
    }

    // Check if the target station is already occupied on the SAME LINE
    const [activeOccupant] = await db.select({
      id: operatorSessions.id,
      userId: operatorSessions.userId
    }).from(operatorSessions)
      .where(and(
        eq(operatorSessions.lineId, activeSession.lineId),
        eq(operatorSessions.station, newStation),
        eq(operatorSessions.isActive, true)
      ))
      .limit(1);

    if (activeOccupant && activeOccupant.userId !== userId) {
      throw new BadRequestException({
        message: 'This station is currently occupied by another operator. Please ask them to log out first.',
        code: 'STATION_OCCUPIED',
        ownerId: activeOccupant.userId
      });
    }

    // Update the session
    const [updatedSession] = await db.update(operatorSessions)
      .set({ 
        station: newStation,
        lastActivityAt: new Date(),
      })
      .where(eq(operatorSessions.id, activeSession.id))
      .returning();

    // Log STATION_CHANGE event to audit log
    await this.auditService.logAction({
      userId,
      action: 'STATION_CHANGE',
      category: 'AUTH',
      payload: {
        fromStation: activeSession.station,
        toStation: newStation,
        lineId: activeSession.lineId
      }
    });

    // Invalidate Cache
    if (this.redis.getAvailability()) {
      this.redis.del(`operator_session:${userId}`).catch(() => {});
      this.redis.set(`operator_session:${userId}`, JSON.stringify(updatedSession), 'EX', 3600 * 12).catch(() => {});
    }

    return updatedSession;
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
