import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { operatorSessions, productionBatches, users as usersTable, productionLines, terminals } from '../../database/schema';
import { eq, and, desc, not, sql, lt, ne } from 'drizzle-orm';
import { RedisService } from '../../providers/redis/redis.service';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class OperatorSessionsService {
  private readonly logger = new Logger(OperatorSessionsService.name);
  constructor(
    private readonly redis: RedisService
  ) {}

  async getTerminalById(id: string) {
    const [terminal] = await db.select().from(terminals).where(eq(terminals.id, id)).limit(1);
    return terminal;
  }

  async startSession(userId: string, lineId: string, station: string, shiftId?: string, force = false, terminalId?: string, supervisorId?: string) {
    this.logger.log(`[SESSION_TRACE] Attempting to start session. User: ${userId}, Line: ${lineId}, Station: ${station}, Force: ${force}`);

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId) || !uuidRegex.test(lineId)) {
      throw new BadRequestException('Invalid User ID or Line ID format.');
    }

    return await db.transaction(async (tx) => {
      // 1. Get Line State
      const [line] = await tx.select().from(productionLines).where(eq(productionLines.id, lineId)).limit(1);
      if (!line) throw new BadRequestException('Line not found');

      // 2. Ownership Governance
      // If line is NOT idle and has an owner, check if current user is the owner
      if (line.status !== 'IDLE' && line.currentOperatorId && line.currentOperatorId !== userId) {
        if (!supervisorId && !force) {
          this.logger.warn(`[SESSION_BLOCK] Line ${line.name} is owned by another operator.`);
          throw new ConflictException({
            message: 'Supervisor Authorization Required',
            code: 'SUPERVISOR_OVERRIDE_REQUIRED',
            ownerId: line.currentOperatorId
          });
        }
        
        if (supervisorId) {
          this.logger.log(`[SESSION_OVERRIDE] Supervisor ${supervisorId} authorizing takeover of line ${line.name}`);
          // Close previous owner's session if it exists
          const [prevSession] = await tx.select().from(operatorSessions)
            .where(and(eq(operatorSessions.lineId, lineId), eq(operatorSessions.isActive, true)))
            .limit(1);
          
          if (prevSession) {
            await tx.update(operatorSessions)
              .set({ isActive: false, endTime: new Date(), endedBy: supervisorId, endReason: 'supervisor_takeover' })
              .where(eq(operatorSessions.id, prevSession.id));
          }
        }
      }

      // 3. Close operator's other active sessions (can't be in two places at once)
      const [existing] = await tx.select().from(operatorSessions)
        .where(and(eq(operatorSessions.userId, userId), eq(operatorSessions.isActive, true)))
        .limit(1);

      if (existing) {
        if (existing.lineId === lineId && existing.station === station) {
          return existing; // Seamless resume
        }
        await tx.update(operatorSessions)
          .set({ isActive: false, endTime: new Date(), endedBy: userId, endReason: 'switched_station' })
          .where(eq(operatorSessions.id, existing.id));
      }

      // 4. Bind to active batch
      const [activeBatch] = await tx.select().from(productionBatches)
        .where(and(eq(productionBatches.lineId, lineId), eq(productionBatches.status, 'RUNNING')))
        .limit(1);

      // 5. Determine Factory
      const factoryId = activeBatch?.factoryId || (await tx.select({ f: usersTable.factoryId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0]?.f;

      // 6. Create Session
      const [session] = await tx.insert(operatorSessions).values({
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

      // 7. Update Line Ownership & Status
      await tx.update(productionLines)
        .set({
          currentOperatorId: userId,
          currentSessionId: session.id,
          sessionStartedAt: new Date(),
          status: line.status === 'IDLE' ? 'RUNNING' : line.status, // Auto-start if idle
          updatedAt: new Date()
        })
        .where(eq(productionLines.id, lineId));

      this.logger.log(`[SESSION_SUCCESS] Session ${session.id} started. Operator ${userId} owns line ${lineId}`);
      
      return session;
    });
  }


  async endSession(userId: string, endedBy?: string, reason = 'manual') {
    return await db.transaction(async (tx) => {
      const [active] = await tx.select().from(operatorSessions)
        .where(and(eq(operatorSessions.userId, userId), eq(operatorSessions.isActive, true)))
        .limit(1);

      if (!active) return null;

      const [session] = await tx.update(operatorSessions)
        .set({ isActive: false, endTime: new Date(), endedBy: endedBy || userId, endReason: reason })
        .where(eq(operatorSessions.id, active.id))
        .returning();

      // Check if this was the "primary" owner of the line
      const [line] = await tx.select().from(productionLines).where(eq(productionLines.currentSessionId, active.id)).limit(1);
      if (line) {
        await tx.update(productionLines)
          .set({ 
            currentOperatorId: null, 
            currentSessionId: null, 
            sessionStartedAt: null,
            // If the session ended, we might want to keep the status as is, 
            // but factory logic says if owner leaves, maybe it stays RUNNING but un-owned
          })
          .where(eq(productionLines.id, line.id));
      }

      // Invalidate Cache
      if (this.redis.getAvailability()) {
        this.redis.del(`operator_session:${userId}`).catch(() => {});
      }

      return session;
    });
  }

  async getCurrentSession(userId: string) {
    // Try cache first (only if available)
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
    return await db.select({
      id: operatorSessions.id,
      lineId: operatorSessions.lineId,
      lineName: productionLines.name,
      station: operatorSessions.station,
      createdAt: operatorSessions.createdAt
    })
    .from(operatorSessions)
    .leftJoin(productionLines, eq(operatorSessions.lineId, productionLines.id))
    .where(eq(operatorSessions.userId, userId))
    .orderBy(desc(operatorSessions.createdAt))
    .limit(5);
  }

  async getAllActiveSessions() {
    return await db.select({
      id: operatorSessions.id,
      lineId: operatorSessions.lineId,
      station: operatorSessions.station,
      userId: operatorSessions.userId,
      userName: usersTable.name
    })
    .from(operatorSessions)
    .leftJoin(usersTable, eq(operatorSessions.userId, usersTable.id))
    .where(eq(operatorSessions.isActive, true));
  }

  async heartbeat(userId: string) {
    const session = await this.getCurrentSession(userId);
    if (!session) return;

    // Update DB
    await db.update(operatorSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(operatorSessions.id, session.id));

    // Update Cache
    session.lastActivityAt = new Date();
    await this.redis.set(`operator_session:${userId}`, JSON.stringify(session), 'EX', 3600 * 12);
  }

  async cleanupStaleSessions() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const stale = await db.select({
      id: operatorSessions.id,
      userId: operatorSessions.userId
    }).from(operatorSessions)
      .where(and(
        eq(operatorSessions.isActive, true),
        lt(operatorSessions.lastActivityAt, thirtyMinutesAgo)
      ));

    for (const session of stale) {
      await this.endSession(session.userId, undefined, 'timeout');
    }

    return stale.length;
  }
}
