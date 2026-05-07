import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { notifications, deviceTokens, users, roles, userRoles } from '../../database/schema';
import { eq, inArray } from 'drizzle-orm';
import { ProductionEventsService } from '../../realtime/production.gateway';
import { OneSignalService } from '../../integrations/onesignal.service';

// In-memory rate limiter: key → last fire timestamp
const notifCooldowns = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per dedupe key

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly eventsService: ProductionEventsService,
    private readonly oneSignalService: OneSignalService,
  ) {}

  /**
   * Core: persist notification → emit WebSocket → send OneSignal Push
   */
  async createNotification(
    type: string,
    title: string,
    message: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    dedupeKey?: string,
  ) {
    // ── Rate-limit repeated identical alerts ──
    if (dedupeKey) {
      const lastFired = notifCooldowns.get(dedupeKey) ?? 0;
      if (Date.now() - lastFired < COOLDOWN_MS) {
        this.logger.debug(`Suppressed duplicate: ${dedupeKey}`);
        return null;
      }
      notifCooldowns.set(dedupeKey, Date.now());
    }

    // ── Persist ──
    const [notif] = await db.insert(notifications).values({
      type, title, message, severity,
    }).returning();

    this.logger.log(`[${severity}] ${title}`);

    // ── Real-time in-app (Pusher) ──
    await this.eventsService.emitNotification(notif);

    // ── OneSignal Push to all Admins & Managers ──
    this.broadcastOneSignalPush(title, message, { type, severity }).catch((e) =>
      this.logger.error('OneSignal broadcast error:', e.message),
    );

    return notif;
  }

  /**
   * Target all users with role SUPER_ADMIN, ADMIN, or MANAGER
   */
  private async broadcastOneSignalPush(title: string, body: string, data: Record<string, string>) {
    const targetUsers = await db.select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(inArray(roles.slug, ['SUPER_ADMIN', 'ADMIN', 'MANAGER']));

    const userIds = Array.from(new Set(targetUsers.map((u) => u.id)));
    if (userIds.length === 0) return;

    await this.oneSignalService.sendToUsers(userIds, title, body, data);
  }

  /**
   * Register a OneSignal Subscription ID for a user.
   */
  async registerToken(
    userId: string,
    token: string,
    platform: 'web' | 'android' | 'ios' = 'web',
  ) {
    // Upsert by token
    await db.delete(deviceTokens).where(eq(deviceTokens.token, token));

    const [record] = await db.insert(deviceTokens).values({
      userId,
      token,
      platform,
    }).returning();

    this.logger.log(`OneSignal token registered for user ${userId} [${platform}]`);
    return record;
  }

  async removeToken(token: string) {
    await db.delete(deviceTokens).where(eq(deviceTokens.token, token));
  }

  async getUnreadNotifications() {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .orderBy(notifications.createdAt);
  }

  async markAsRead(id: string) {
    const [notif] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return notif;
  }

  // ── Typed convenience triggers ──
  async triggerFlowViolation(details: string, batchId: string) {
    return this.createNotification('FLOW_VIOLATION', 'Flow Violation', details, 'CRITICAL', `flow:${batchId}`);
  }

  async triggerAnomalyAlert(details: string, batchId: string) {
    return this.createNotification('ANOMALY', 'Production Anomaly', details, 'WARNING', `anomaly:${batchId}`);
  }

  async triggerLineStopped(lineName: string, lineId: string) {
    return this.createNotification(
      'LINE_STOPPED', `Line Stopped: ${lineName}`,
      `Production line "${lineName}" has been inactive.`, 'CRITICAL', `stopped:${lineId}`,
    );
  }

  async triggerBatchMilestone(batchId: string, percentage: number, lineName: string) {
    return this.createNotification(
      'MILESTONE', `Batch ${percentage}% Complete`,
      `Batch on ${lineName} has reached ${percentage}% of its target.`, 'INFO',
      `milestone:${batchId}:${percentage}`,
    );
  }
}
