import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { operatorSessions, productionBatches, users as usersTable, terminals, productionLines } from '../../database/schema';
import { eq, and, desc, isNull, or, sql } from 'drizzle-orm';
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

    // Wrap everything in a database transaction for concurrency safety
    return await db.transaction(async (tx) => {
      // 1. Idempotent reuse: if active session exists on this station, reuse it
      const [existingActive] = await tx.select().from(operatorSessions)
        .where(and(
          eq(operatorSessions.userId, userId),
          eq(operatorSessions.lineId, lineId),
          eq(operatorSessions.station, station),
          eq(operatorSessions.isActive, true)
        ))
        .limit(1);

      if (existingActive) {
        this.logger.log(`[SESSION_TRACE] Active session already exists for User: ${userId}, Line: ${lineId}, Station: ${station}. Reusing.`);
        // Update last activity timestamp
        await tx.update(operatorSessions)
          .set({ lastActivityAt: new Date() })
          .where(eq(operatorSessions.id, existingActive.id));
        return { ...existingActive, lastActivityAt: new Date() };
      }

      // 2. Find and auto-close stale/orphan sessions on this line and station, or operator's own stale sessions
      const sessionTimeoutMs = Number(process.env.SESSION_TIMEOUT_MS) || 30 * 60 * 1000;
      const staleThreshold = new Date(Date.now() - sessionTimeoutMs);

      // Fetch all active sessions on this station to clean up stale ones
      const activeOccupants = await tx.select().from(operatorSessions)
        .where(and(
          eq(operatorSessions.lineId, lineId),
          eq(operatorSessions.station, station),
          eq(operatorSessions.isActive, true)
        ));

      for (const occupant of activeOccupants) {
        const lastActivity = occupant.lastActivityAt || occupant.startTime;
        if (lastActivity < staleThreshold) {
          this.logger.log(`[SESSION_TRACE] Auto-closing stale session ${occupant.id} of User ${occupant.userId}`);
          await tx.update(operatorSessions)
            .set({
              isActive: false,
              endTime: new Date(),
              endedBy: occupant.userId,
              endReason: 'timeout'
            })
            .where(eq(operatorSessions.id, occupant.id));
            
          if (this.redis.getAvailability()) {
            this.redis.del(`operator_session:${occupant.userId}`).catch(() => {});
          }
        }
      }

      // Clean up operator's own stale sessions on other lines/stations
      const myActiveSessions = await tx.select().from(operatorSessions)
        .where(and(
          eq(operatorSessions.userId, userId),
          eq(operatorSessions.isActive, true)
        ));

      for (const mySession of myActiveSessions) {
        const lastActivity = mySession.lastActivityAt || mySession.startTime;
        if (lastActivity < staleThreshold) {
          this.logger.log(`[SESSION_TRACE] Auto-closing own stale session ${mySession.id}`);
          await tx.update(operatorSessions)
            .set({
              isActive: false,
              endTime: new Date(),
              endedBy: userId,
              endReason: 'timeout'
            })
            .where(eq(operatorSessions.id, mySession.id));
            
          if (this.redis.getAvailability()) {
            this.redis.del(`operator_session:${userId}`).catch(() => {});
          }
        }
      }

      // 3. Force takeover handling: if force is true, end other active occupants' sessions
      if (force) {
        const nonStaleOccupants = await tx.select().from(operatorSessions)
          .where(and(
            eq(operatorSessions.lineId, lineId),
            eq(operatorSessions.station, station),
            eq(operatorSessions.isActive, true)
          ));

        for (const occupant of nonStaleOccupants) {
          if (occupant.userId !== userId) {
            this.logger.log(`[SESSION_TRACE] Force ending occupant session ${occupant.id} of User ${occupant.userId}`);
            await tx.update(operatorSessions)
              .set({
                isActive: false,
                endTime: new Date(),
                endedBy: supervisorId || userId,
                endReason: supervisorId ? 'supervisor_takeover' : 'forced_takeover'
              })
              .where(eq(operatorSessions.id, occupant.id));

            if (this.redis.getAvailability()) {
              this.redis.del(`operator_session:${occupant.userId}`).catch(() => {});
            }
          }
        }
      }

      // 4. Bind to active batch (Global)
      const [activeBatch] = await tx.select().from(productionBatches)
        .where(or(eq(productionBatches.status, 'RUNNING'), eq(productionBatches.status, 'CHANGEOVER')))
        .orderBy(desc(productionBatches.startTime))
        .limit(1);

      // Determine Factory
      const factoryId = activeBatch?.factoryId || (await tx.select({ f: usersTable.factoryId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0]?.f;

      // Create Session
      const [session] = await tx.insert(operatorSessions).values({
        userId,
        lineId,
        station,
        batchId: activeBatch?.id || null,
        shiftId: shiftId || null,
        factoryId: factoryId,
        terminalId: terminalId || null,
        isActive: true,
        startTime: new Date(),
        lastActivityAt: new Date()
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
    });
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

    // Check if the user is changing to the station they are already on
    if (activeSession.station === newStation) {
      return activeSession;
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
    return await db.select({
      id: operatorSessions.id,
      userId: operatorSessions.userId,
      userName: usersTable.name,
      lineId: operatorSessions.lineId,
      station: operatorSessions.station,
      isActive: operatorSessions.isActive,
      startTime: operatorSessions.startTime,
      lastActivityAt: operatorSessions.lastActivityAt
    })
    .from(operatorSessions)
    .innerJoin(usersTable, eq(operatorSessions.userId, usersTable.id))
    .where(eq(operatorSessions.isActive, true));
  }

  async heartbeat(userId: string) {
    await db.update(operatorSessions)
      .set({ lastActivityAt: new Date() })
      .where(and(eq(operatorSessions.userId, userId), eq(operatorSessions.isActive, true)));
      
    if (this.redis.getAvailability()) {
      this.redis.del(`operator_session:${userId}`).catch(() => {});
    }
  }

  async cleanupStaleSessions() {
    const sessionTimeoutMs = Number(process.env.SESSION_TIMEOUT_MS) || 30 * 60 * 1000;
    const staleThreshold = new Date(Date.now() - sessionTimeoutMs);

    const staleSessions = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.isActive, true),
        or(
          isNull(operatorSessions.lastActivityAt),
          sql`${operatorSessions.lastActivityAt} < ${staleThreshold}`
        )
      ));

    if (staleSessions.length === 0) return 0;

    let closedCount = 0;
    for (const session of staleSessions) {
      await db.update(operatorSessions)
        .set({
          isActive: false,
          endTime: new Date(),
          endedBy: session.userId,
          endReason: 'timeout'
        })
        .where(eq(operatorSessions.id, session.id));
        
      if (this.redis.getAvailability()) {
        this.redis.del(`operator_session:${session.userId}`).catch(() => {});
      }
      closedCount++;
    }

    return closedCount;
  }
}
