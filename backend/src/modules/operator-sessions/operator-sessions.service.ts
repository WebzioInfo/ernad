import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { operatorSessions, productionBatches, users as usersTable, productionLines, machineStates, shiftHandovers, batchTotals, roles, userRoles, permissions, rolePermissions } from '../../database/schema';
import { eq, and, desc, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { RedisService } from '../../providers/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { ProductionEventsService } from '../../realtime/production.gateway';
import { ShiftHandoverDto } from './dto/operator-sessions.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class OperatorSessionsService {
  private readonly logger = new Logger(OperatorSessionsService.name);
  private activeSessionsCache: { data: any; expiresAt: number } | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
    private readonly eventsService: ProductionEventsService,
    private readonly jwtService: JwtService
  ) {}

  async startSession(userId: string, lineId: string, station: string, shiftId?: string, force = false, terminalId?: string, supervisorId?: string) {
    this.activeSessionsCache = null;
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
          .set({ lastActivity: new Date() })
          .where(eq(operatorSessions.id, existingActive.id));
        return { ...existingActive, lastActivity: new Date() };
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
        const lastActivity = occupant.lastActivity || occupant.startTime;
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
        const lastActivity = mySession.lastActivity || mySession.startTime;
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

      // Create Session
      const [session] = await tx.insert(operatorSessions).values({
        userId,
        lineId,
        station,
        batchId: activeBatch?.id || null,
        shiftId: shiftId || null,
        isActive: true,
        startTime: new Date(),
        lastActivity: new Date()
      }).returning();

      // Log LOGIN event to audit log
      await this.auditService.logAction({
        userId,
        action: 'LOGIN',
        category: 'AUTH',
        payload: {
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
    this.activeSessionsCache = null;
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
    this.activeSessionsCache = null;
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
        lastActivity: new Date(),
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
    const now = Date.now();
    if (this.activeSessionsCache && this.activeSessionsCache.expiresAt > now) {
      return this.activeSessionsCache.data;
    }

    const data = await db.select({
      id: operatorSessions.id,
      userId: operatorSessions.userId,
      userName: usersTable.name,
      lineId: operatorSessions.lineId,
      station: operatorSessions.station,
      isActive: operatorSessions.isActive,
      startTime: operatorSessions.startTime,
      lastActivity: operatorSessions.lastActivity
    })
    .from(operatorSessions)
    .innerJoin(usersTable, eq(operatorSessions.userId, usersTable.id))
    .where(eq(operatorSessions.isActive, true));

    this.activeSessionsCache = { data, expiresAt: now + 5000 };
    return data;
  }

  async heartbeat(userId: string) {
    await db.update(operatorSessions)
      .set({ lastActivity: new Date() })
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
          isNull(operatorSessions.lastActivity),
          sql`${operatorSessions.lastActivity} < ${staleThreshold}`
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

  async initiateHandover(outgoingUserId: string, dto: ShiftHandoverDto) {
    this.activeSessionsCache = null;
    this.logger.log(`[HANDOVER_TRACE] Initiating shift handover. Outgoing: ${outgoingUserId}, Incoming: ${dto.incomingOperatorId}`);

    if (outgoingUserId === dto.incomingOperatorId) {
      throw new BadRequestException('Outgoing and incoming operators must be different.');
    }

    return await db.transaction(async (tx) => {
      // 1. Get active session of outgoing operator
      const [outgoingSession] = await tx.select().from(operatorSessions)
        .where(and(
          eq(operatorSessions.userId, outgoingUserId),
          eq(operatorSessions.isActive, true)
        ))
        .limit(1);

      if (!outgoingSession) {
        throw new BadRequestException('Outgoing operator does not have an active session.');
      }

      // 2. Verify incoming operator ID and PIN
      const [incomingUser] = await tx.select().from(usersTable)
        .where(eq(usersTable.id, dto.incomingOperatorId))
        .limit(1);

      if (!incomingUser || !incomingUser.isActive) {
        throw new BadRequestException('Invalid or inactive incoming operator.');
      }

      const isPinValid = await bcrypt.compare(dto.incomingOperatorPin, incomingUser.pinCode);
      if (!isPinValid) {
        throw new BadRequestException('Invalid PIN code for incoming operator.');
      }

      // 3. Resolve active batch context
      let batchId = outgoingSession.batchId;
      if (!batchId) {
        // Fallback: find active batch on the line
        const [activeBatch] = await tx.select({ id: productionBatches.id }).from(productionBatches)
          .where(and(
            eq(productionBatches.lineId, outgoingSession.lineId),
            or(eq(productionBatches.status, 'RUNNING'), eq(productionBatches.status, 'CHANGEOVER'))
          ))
          .orderBy(desc(productionBatches.startTime))
          .limit(1);
        batchId = activeBatch?.id || null;
      }

      if (!batchId) {
        throw new BadRequestException('No active production batch found for this line.');
      }

      // 4. Capture current production and waste snapshots from batchTotals
      let productionCount = 0;
      let wasteCount = 0;

      const [totals] = await tx.select().from(batchTotals)
        .where(eq(batchTotals.batchId, batchId))
        .limit(1);

      if (totals) {
        const stationUpper = outgoingSession.station.toUpperCase();
        if (stationUpper === 'BLOWING') {
          productionCount = totals.blowingTotal;
        } else if (stationUpper === 'FILLING') {
          productionCount = totals.fillingTotal;
        } else if (stationUpper === 'LABELING') {
          productionCount = totals.labelingTotal;
        } else if (stationUpper === 'PACKING') {
          productionCount = totals.packingTotal;
        }
        wasteCount = Number(totals.scrapTotal) || 0;
      }

      // 5. Retrieve current machine state
      const [mState] = await tx.select().from(machineStates)
        .where(and(
          eq(machineStates.lineId, outgoingSession.lineId),
          eq(machineStates.station, outgoingSession.station.toUpperCase())
        ))
        .limit(1);
      const machineStateSnapshot = mState?.state || 'STOPPED';

      // 6. Terminate outgoing operator session
      await tx.update(operatorSessions)
        .set({
          isActive: false,
          endTime: new Date(),
          endedBy: outgoingUserId,
          endReason: 'handover'
        })
        .where(eq(operatorSessions.id, outgoingSession.id));

      if (this.redis.getAvailability()) {
        this.redis.del(`operator_session:${outgoingUserId}`).catch(() => {});
      }

      // 7. Auto-start new operator session for incoming operator
      const [incomingSession] = await tx.insert(operatorSessions).values({
        userId: dto.incomingOperatorId,
        lineId: outgoingSession.lineId,
        station: outgoingSession.station,
        batchId,
        shiftId: outgoingSession.shiftId,
        isActive: true,
        startTime: new Date(),
        lastActivity: new Date()
      }).returning();

      if (this.redis.getAvailability()) {
        this.redis.del(`operator_session:${dto.incomingOperatorId}`).catch(() => {});
      }

      // 8. Save shift handover audit log
      const [handover] = await tx.insert(shiftHandovers).values({
        lineId: outgoingSession.lineId,
        station: outgoingSession.station,
        batchId,
        outgoingOperatorId: outgoingUserId,
        incomingOperatorId: dto.incomingOperatorId,
        handoverTime: new Date(),
        outgoingSessionId: outgoingSession.id,
        incomingSessionId: incomingSession.id,
        notes: dto.notes || null,
        pendingIssues: dto.pendingIssues || null,
        machineStateSnapshot,
        productionCountSnapshot: productionCount,
        wasteCountSnapshot: wasteCount,
        materialStateConfirmed: dto.materialStateConfirmed,
        machineStatusAcknowledged: dto.machineStatusAcknowledged,
      }).returning();

      // 9. Log action in Audit Ledger
      await this.auditService.logAction({
        userId: outgoingUserId,
        action: 'SHIFT_HANDOVER',
        category: 'PRODUCTION',
        payload: {
          lineId: outgoingSession.lineId,
          station: outgoingSession.station,
          batchId,
          incomingOperatorId: dto.incomingOperatorId,
          productionCount,
          wasteCount,
          machineStateSnapshot,
        }
      });

      // 10. Broadcast Pusher Events
      try {
        await this.eventsService.emitProductionUpdated(batchId, outgoingSession.lineId);
        await this.eventsService.emitShiftHandover({
          id: handover.id,
          lineId: outgoingSession.lineId,
          station: outgoingSession.station,
          batchId,
          outgoingOperatorId: outgoingUserId,
          incomingOperatorId: dto.incomingOperatorId,
          handoverTime: handover.handoverTime,
          notes: handover.notes,
          pendingIssues: handover.pendingIssues,
          machineStateSnapshot,
          productionCountSnapshot: productionCount,
          wasteCountSnapshot: wasteCount,
        });
      } catch (err) {
        this.logger.error('Failed to broadcast shift handover events', err);
      }

      // 9. Fetch roles and permissions of incoming user to generate JWT token
      const userRolesResult = await tx.select({
        id: roles.id,
        slug: roles.slug,
      })
      .from(roles)
      .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, incomingUser.id));

      const roleSlugs = Array.from(new Set(userRolesResult.map(r => {
        const slug = (r.slug || '').toUpperCase().trim();
        if (slug === 'GENERIC OPERATOR') return 'OPERATOR';
        if (slug === 'PRODUCTION MANAGER') return 'MANAGER';
        if (slug.includes('ADMIN')) return 'ADMIN';
        if (slug.includes('MANAGER')) return 'MANAGER';
        return 'OPERATOR';
      })));

      const sortedRoles = [...roleSlugs].sort((a, b) => {
        const order = ['ADMIN', 'MANAGER', 'OPERATOR'];
        let idxA = order.indexOf(a);
        let idxB = order.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });

      const effectiveRole = sortedRoles.find(r => r === 'OPERATOR') || sortedRoles[0] || 'OPERATOR';

      let permissionsSlugs: string[] = [];
      if (userRolesResult.length > 0) {
        const perms = await tx.select({
          slug: permissions.slug,
        })
        .from(permissions)
        .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
        .where(or(...userRolesResult.map(r => eq(rolePermissions.roleId, r.id))));
        
        permissionsSlugs = Array.from(new Set(perms.map(p => p.slug)));
      }

      const payload = {
        sub: incomingUser.id,
        id: incomingUser.id,
        username: incomingUser.username,
        role: effectiveRole,
        roles: sortedRoles,
        permissions: permissionsSlugs,
        name: incomingUser.name,
        sessionId: incomingSession.id,
        deviceId: undefined
      };

      const token = await this.jwtService.signAsync(payload);

      return {
        handover,
        incomingSession,
        access_token: token,
        user: {
          id: incomingUser.id,
          name: incomingUser.name,
          username: incomingUser.username,
          role: effectiveRole,
          roles: sortedRoles,
          permissions: permissionsSlugs,
          sessionId: incomingSession.id,
        }
      };
    });
  }

  async getRecentHandover(lineId: string, station: string) {
    const outgoingUser = alias(usersTable, 'outgoing_user');
    const incomingUser = alias(usersTable, 'incoming_user');

    const [handover] = await db.select({
      id: shiftHandovers.id,
      lineId: shiftHandovers.lineId,
      station: shiftHandovers.station,
      batchId: shiftHandovers.batchId,
      outgoingOperatorId: shiftHandovers.outgoingOperatorId,
      outgoingOperatorName: outgoingUser.name,
      incomingOperatorId: shiftHandovers.incomingOperatorId,
      incomingOperatorName: incomingUser.name,
      handoverTime: shiftHandovers.handoverTime,
      notes: shiftHandovers.notes,
      pendingIssues: shiftHandovers.pendingIssues,
      machineStateSnapshot: shiftHandovers.machineStateSnapshot,
      productionCountSnapshot: shiftHandovers.productionCountSnapshot,
      wasteCountSnapshot: shiftHandovers.wasteCountSnapshot,
    })
    .from(shiftHandovers)
    .leftJoin(outgoingUser, eq(shiftHandovers.outgoingOperatorId, outgoingUser.id))
    .leftJoin(incomingUser, eq(shiftHandovers.incomingOperatorId, incomingUser.id))
    .where(and(
      eq(shiftHandovers.lineId, lineId),
      eq(shiftHandovers.station, station)
    ))
    .orderBy(desc(shiftHandovers.handoverTime))
    .limit(1);

    return handover || null;
  }
}
