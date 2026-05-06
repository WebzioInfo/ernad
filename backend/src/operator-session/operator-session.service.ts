import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { db } from '../db/db';
import { operatorSessions, productionBatches, users as usersTable, productionLines } from '../db/schema';
import { eq, and, desc, not, sql } from 'drizzle-orm';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class OperatorSessionService {
  constructor(private readonly redis: RedisService) {}

  async startSession(userId: string, lineId: string, station: string, shiftId?: string, force = false) {
    // 1. Check if operator already has an active session
    const [existing] = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.userId, userId),
        eq(operatorSessions.isActive, true)
      ))
      .limit(1);

    if (existing && !force) {
      throw new ConflictException('Operator already has an active session.');
    }

    if (existing && force) {
      await this.endSession(userId, userId, 'forced_takeover');
    }

    // 2. Check if station is occupied by someone else
    const [occupied] = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.lineId, lineId),
        eq(operatorSessions.station, station),
        eq(operatorSessions.isActive, true),
        not(eq(operatorSessions.userId, userId))
      ))
      .limit(1);

    if (occupied && !force) {
      throw new ConflictException(`Station occupied by another operator.`);
    }

    if (occupied && force) {
      await this.endSession(occupied.userId, userId, 'displaced');
    }

    // 3. Bind to active batch if exists
    const [activeBatch] = await db.select().from(productionBatches)
      .where(and(
        eq(productionBatches.lineId, lineId),
        eq(productionBatches.status, 'RUNNING')
      ))
      .limit(1);

    // 4. Create new session
    const [session] = await db.insert(operatorSessions).values({
      userId,
      lineId,
      station,
      batchId: activeBatch?.id || null,
      shiftId: shiftId || null,
      factoryId: activeBatch?.factoryId || null, // Capture factory context
      isActive: true,
      startTime: new Date()
    }).returning();

    // 5. Cache in Redis (Fast Validation)
    await this.redis.set(`operator_session:${userId}`, JSON.stringify(session), 'EX', 3600 * 12);

    return session;
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
    await this.redis.del(`operator_session:${userId}`);

    return session;
  }

  async getCurrentSession(userId: string) {
    // Try cache first
    const cached = await this.redis.get(`operator_session:${userId}`);
    if (cached) return JSON.parse(cached);

    const [session] = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.userId, userId),
        eq(operatorSessions.isActive, true)
      ))
      .limit(1);

    if (session) {
      await this.redis.set(`operator_session:${userId}`, JSON.stringify(session), 'EX', 3600 * 12);
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
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    
    const stale = await db.select().from(operatorSessions)
      .where(and(
        eq(operatorSessions.isActive, true),
        sql`${operatorSessions.lastActivityAt} < ${fourHoursAgo}`
      ));

    for (const session of stale) {
      await this.endSession(session.userId, 'SYSTEM', 'timeout');
    }

    return stale.length;
  }
}
