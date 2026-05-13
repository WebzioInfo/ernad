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

  async startSession(userId: string, lineId: string, station: string, shiftId?: string, force = false, terminalId?: string) {
    this.logger.log(`[SESSION_TRACE] Attempting to start session for User: ${userId}, Line: ${lineId}, Station: ${station}`);

    // Validate UUIDs to prevent PG type errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId) || !uuidRegex.test(lineId)) {
      this.logger.error(`[SESSION_INVALID_ID] Invalid UUID provided. User: ${userId}, Line: ${lineId}`);
      throw new BadRequestException('Invalid User ID or Line ID format. Must be a valid UUID.');
    }

    try {
      // 1. Check if operator already has an active session
      const [existing] = await db.select().from(operatorSessions)
        .where(and(
          eq(operatorSessions.userId, userId),
          eq(operatorSessions.isActive, true)
        ))
        .limit(1);

      if (existing) {
        // CASE 1: Same Line & Same Station => Seamless Resume
        if (existing.lineId === lineId && existing.station === station) {
          this.logger.log(`[SESSION_RESUME] Operator ${userId} resuming existing session on line ${lineId}, station ${station}`);
          return existing;
        }

        // CASE 2: Different Line/Station => Requires Force/Takeover
        if (!force) {
          const [line] = await db.select({ name: productionLines.name }).from(productionLines).where(eq(productionLines.id, existing.lineId)).limit(1);
          this.logger.warn(`[SESSION_CONFLICT] Operator ${userId} already has an active session on line ${line?.name || existing.lineId}`);
          throw new ConflictException(`You already have an active session on ${line?.name || 'another line'} (${existing.station}). Close it or use Force Takeover to switch.`);
        } else {
          this.logger.log(`[SESSION_FORCE] Closing existing session for operator ${userId} to switch context.`);
          await this.endSession(userId, userId, 'forced_switch');
        }
      }

      // 2. Check if station is occupied by someone else
      const [occupied] = await db.select({
        userId: operatorSessions.userId,
        userName: usersTable.name
      })
        .from(operatorSessions)
        .leftJoin(usersTable, eq(operatorSessions.userId, usersTable.id))
        .where(and(
          eq(operatorSessions.lineId, lineId),
          eq(operatorSessions.station, station),
          eq(operatorSessions.isActive, true),
          ne(operatorSessions.userId, userId)
        ))
        .limit(1);

      if (occupied) {
        const occupantName = occupied.userName || 'Another operator';
        if (!force) {
          this.logger.warn(`[SESSION_CONFLICT] Station ${station} on line ${lineId} is occupied by ${occupantName}`);
          throw new ConflictException(`This station is currently occupied by ${occupantName}.`);
        } else {
          this.logger.log(`[SESSION_FORCE] Displacing operator ${occupied.userId} (${occupantName}) from station ${station}`);
          await this.endSession(occupied.userId, userId, 'displaced_by_takeover');
        }
      }

      // 3. Bind to active batch if exists
      const [activeBatch] = await db.select().from(productionBatches)
        .where(and(
          eq(productionBatches.lineId, lineId),
          eq(productionBatches.status, 'RUNNING')
        ))
        .limit(1);

      // 4. Capture Factory Context (Fallback to user's home factory)
      let factoryId = activeBatch?.factoryId;
      if (!factoryId) {
        const [user] = await db.select({ factoryId: usersTable.factoryId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        factoryId = user?.factoryId;
      }

      if (!factoryId) {
        throw new BadRequestException('Cannot determine factory context for session.');
      }

      // 5. Create new session
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

      this.logger.log(`[SESSION_SUCCESS] Session ${session.id} started successfully.`);

      // 6. Cache in Redis (Fast Validation)
      if (this.redis.getAvailability()) {
        await this.redis.set(`operator_session:${userId}`, JSON.stringify(session), 'EX', 3600 * 12).catch(e => {
           this.logger.warn(`[SESSION_REDIS_ERR] Failed to cache session: ${e.message}`);
        });
      }

      return session;
    } catch (error: any) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      
      // PostgreSQL Unique Constraint Violation (Code 23505)
      if (error.code === '23505') {
        this.logger.warn(`[SESSION_DB_CONFLICT] Duplicate active session detected for User: ${userId}`);
        throw new ConflictException('Operator already has an active session.');
      }

      this.logger.error(`[SESSION_CRITICAL_FAILURE] Failed to start session: ${error.message}`, error.stack);
      throw new Error(`Session initialization failed: ${error.message}`);
    }
  }


  async endSession(userId: string, endedBy?: string, reason = 'manual') {
    const [active] = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.userId, userId),
        eq(operatorSessions.isActive, true)
      ))
      .limit(1);

    if (!active) return null;

    const [session] = await db.update(operatorSessions)
      .set({ 
        isActive: false, 
        endTime: new Date(),
        endedBy: endedBy || userId,
        endReason: reason
      })
      .where(eq(operatorSessions.id, active.id))
      .returning();

    // Invalidate Cache
    if (this.redis.getAvailability()) {
      this.redis.del(`operator_session:${userId}`).catch(() => {});
    }

    return session;
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
