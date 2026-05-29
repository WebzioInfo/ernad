import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../database/db';
import {
  auditLogs,
  downtimeLogs,
  incidentAssignments,
  incidentAttachments,
  incidentComments,
  incidentHistory,
  incidents,
  incidentTypes,
  productionBatches,
  productionLines,
  userLines,
  users,
} from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductionEventsService } from '../../realtime/production.gateway';
import {
  AttachmentDto,
  CreateIncidentDto,
  CreateIncidentTypeDto,
  IncidentCategoryDto,
  IncidentPriorityDto,
  IncidentStatusDto,
  StatusIncidentDto,
  UpdateIncidentDto,
} from './dto/incident.dto';

const DEFAULT_TYPES: CreateIncidentTypeDto[] = [
  { name: 'Power Failure', category: IncidentCategoryDto.FACTORY, priority: IncidentPriorityDto.CRITICAL, selfResolvable: false, productionImpact: true, defaultSlaMinutes: 15 },
  { name: 'Generator Failure', category: IncidentCategoryDto.FACTORY, priority: IncidentPriorityDto.CRITICAL, selfResolvable: false, productionImpact: true, defaultSlaMinutes: 20 },
  { name: 'Compressor Failure', category: IncidentCategoryDto.FACTORY, priority: IncidentPriorityDto.CRITICAL, selfResolvable: false, productionImpact: true, defaultSlaMinutes: 20 },
  { name: 'Network Failure', category: IncidentCategoryDto.FACTORY, priority: IncidentPriorityDto.HIGH, selfResolvable: false, productionImpact: true, defaultSlaMinutes: 30 },
  { name: 'Line Stop', category: IncidentCategoryDto.LINE, priority: IncidentPriorityDto.HIGH, selfResolvable: false, productionImpact: true, defaultSlaMinutes: 30 },
  { name: 'Conveyor Failure', category: IncidentCategoryDto.LINE, priority: IncidentPriorityDto.HIGH, selfResolvable: false, productionImpact: true, defaultSlaMinutes: 30 },
  { name: 'Ink Change', category: IncidentCategoryDto.STATION, priority: IncidentPriorityDto.LOW, selfResolvable: true, productionImpact: true, defaultSlaMinutes: 10 },
  { name: 'Make-up Change', category: IncidentCategoryDto.STATION, priority: IncidentPriorityDto.LOW, selfResolvable: true, productionImpact: true, defaultSlaMinutes: 10 },
  { name: 'Label Roll Change', category: IncidentCategoryDto.STATION, priority: IncidentPriorityDto.LOW, selfResolvable: true, productionImpact: true, defaultSlaMinutes: 12 },
  { name: 'Printer Cleaning', category: IncidentCategoryDto.STATION, priority: IncidentPriorityDto.LOW, selfResolvable: true, productionImpact: true, defaultSlaMinutes: 15 },
  { name: 'Leakage', category: IncidentCategoryDto.STATION, priority: IncidentPriorityDto.MEDIUM, selfResolvable: false, productionImpact: true, defaultSlaMinutes: 30 },
  { name: 'Bottle Jam', category: IncidentCategoryDto.STATION, priority: IncidentPriorityDto.MEDIUM, selfResolvable: true, productionImpact: true, defaultSlaMinutes: 15 },
];

@Injectable()
export class IncidentsService {
  private seededTypes = false;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly eventsService: ProductionEventsService,
  ) {}

  async ensureDefaultTypes() {
    if (this.seededTypes) return;
    for (const type of DEFAULT_TYPES) {
      const [existing] = await db.select({ id: incidentTypes.id }).from(incidentTypes).where(and(
        eq(incidentTypes.category, type.category),
        ilike(incidentTypes.name, type.name),
      )).limit(1);
      if (!existing) {
        await db.insert(incidentTypes).values(type as any);
      }
    }
    this.seededTypes = true;
  }

  async getTypes(query: any = {}) {
    await this.ensureDefaultTypes();
    const conditions = [eq(incidentTypes.isActive, true)];
    if (query.category) conditions.push(eq(incidentTypes.category, query.category));
    const rows = await db.select().from(incidentTypes).where(and(...conditions)).orderBy(incidentTypes.category, incidentTypes.name, incidentTypes.createdAt);
    const seen = new Set<string>();
    return rows.filter((type) => {
      const key = `${type.category}:${type.name.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async createType(userId: string, dto: CreateIncidentTypeDto) {
    const [existing] = await db.select().from(incidentTypes).where(and(
      eq(incidentTypes.category, dto.category),
      ilike(incidentTypes.name, dto.name),
      eq(incidentTypes.isActive, true),
    )).limit(1);
    if (existing) throw new BadRequestException('Incident type already exists for this category');

    const [type] = await db.insert(incidentTypes).values(dto as any).returning();
    await this.logAudit(userId, 'INCIDENT_TYPE_CREATED', 'incident_types', type.id, dto);
    return type;
  }

  async findAll(userId: string, roles: string[], query: any = {}) {
    await this.ensureDefaultTypes();
    const conditions: any[] = [isNull(incidents.deletedAt)];

    if (query.status) conditions.push(eq(incidents.status, query.status));
    if (query.priority) conditions.push(eq(incidents.priority, query.priority));
    if (query.category) conditions.push(eq(incidents.category, query.category));
    if (query.lineId) conditions.push(eq(incidents.lineId, query.lineId));
    if (query.stationId) conditions.push(eq(incidents.stationId, query.stationId));
    if (query.incidentTypeId) conditions.push(eq(incidents.incidentTypeId, query.incidentTypeId));
    if (query.operatorId) conditions.push(eq(incidents.reportedBy, query.operatorId));
    if (query.from) conditions.push(gte(incidents.openedAt, new Date(query.from)));
    if (query.to) conditions.push(lte(incidents.openedAt, new Date(query.to)));
    if (query.search) {
      conditions.push(or(
        ilike(incidents.incidentNumber, `%${query.search}%`),
        ilike(incidents.title, `%${query.search}%`),
      ));
    }

    if (this.isOperator(roles) && !this.isManagerOrAdmin(roles)) {
      const assigned = await db.select({ lineId: userLines.lineId }).from(userLines).where(eq(userLines.userId, userId));
      const lineIds = assigned.map((line) => line.lineId);
      conditions.push(or(
        eq(incidents.reportedBy, userId),
        eq(incidents.category, 'FACTORY' as any),
        lineIds.length ? inArray(incidents.lineId, lineIds) : sql`false`,
      ));
    }

    return db.select({
      id: incidents.id,
      incidentNumber: incidents.incidentNumber,
      title: incidents.title,
      description: incidents.description,
      category: incidents.category,
      lineId: incidents.lineId,
      lineName: productionLines.name,
      stationId: incidents.stationId,
      incidentTypeId: incidents.incidentTypeId,
      incidentTypeName: incidentTypes.name,
      priority: incidents.priority,
      status: incidents.status,
      reportedBy: incidents.reportedBy,
      reportedByName: users.name,
      assignedTo: incidents.assignedTo,
      openedAt: incidents.openedAt,
      acknowledgedAt: incidents.acknowledgedAt,
      resolvedAt: incidents.resolvedAt,
      closedAt: incidents.closedAt,
      durationMinutes: incidents.durationMinutes,
      productionImpact: incidents.productionImpact,
      rootCause: incidents.rootCause,
      correctiveAction: incidents.correctiveAction,
      preventiveAction: incidents.preventiveAction,
    })
      .from(incidents)
      .leftJoin(incidentTypes, eq(incidents.incidentTypeId, incidentTypes.id))
      .leftJoin(productionLines, eq(incidents.lineId, productionLines.id))
      .leftJoin(users, eq(incidents.reportedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(incidents.openedAt))
      .limit(query.limit ? Number(query.limit) : 100);
  }

  async findOne(id: string, userId: string, roles: string[]) {
    const rows = await this.findAll(userId, roles, { limit: 500 });
    const incident = rows.find((row: any) => row.id === id);
    if (!incident) throw new NotFoundException('Incident not found');

    const [comments, attachments, history, assignments] = await Promise.all([
      db.select({
        id: incidentComments.id,
        comment: incidentComments.comment,
        createdAt: incidentComments.createdAt,
        authorName: users.name,
      }).from(incidentComments).leftJoin(users, eq(incidentComments.authorId, users.id)).where(eq(incidentComments.incidentId, id)).orderBy(desc(incidentComments.createdAt)),
      db.select().from(incidentAttachments).where(eq(incidentAttachments.incidentId, id)).orderBy(desc(incidentAttachments.createdAt)),
      db.select().from(incidentHistory).where(eq(incidentHistory.incidentId, id)).orderBy(desc(incidentHistory.occurredAt)),
      db.select().from(incidentAssignments).where(eq(incidentAssignments.incidentId, id)).orderBy(desc(incidentAssignments.assignedAt)),
    ]);

    return { ...incident, comments, attachments, history, assignments };
  }

  async create(userId: string, roles: string[], dto: CreateIncidentDto) {
    await this.ensureDefaultTypes();
    this.validateScope(dto.category, dto.lineId, dto.stationId);

    const [type] = await db.select().from(incidentTypes).where(eq(incidentTypes.id, dto.incidentTypeId)).limit(1);
    if (!type) throw new BadRequestException('Incident type not found');
    if (type.category !== dto.category) throw new BadRequestException('Incident category does not match selected incident type');

    if (dto.assignedTo && !this.isManagerOrAdmin(roles)) {
      throw new ForbiddenException('Only managers can assign incidents');
    }

    const openedAt = new Date();
    const incidentNumber = await this.nextIncidentNumber();
    const productionImpact = dto.productionImpact ?? type.productionImpact;
    const priority = dto.priority ?? type.priority;

    const created = await db.transaction(async (tx) => {
      let downtimeLogId: string | null = null;
      if (productionImpact && dto.lineId) {
        const [batch] = await tx.select().from(productionBatches)
          .where(and(eq(productionBatches.lineId, dto.lineId), inArray(productionBatches.status, ['RUNNING', 'CHANGEOVER'] as any)))
          .orderBy(desc(productionBatches.startTime))
          .limit(1);

        if (batch) {
          const [downtime] = await tx.insert(downtimeLogs).values({
            batchId: batch.id,
            lineId: dto.lineId,
            station: dto.stationId || 'GENERAL',
            reason: type.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
            startTime: openedAt,
            remarks: dto.description || dto.title || type.name,
          }).returning();
          downtimeLogId = downtime.id;
        }
      }

      const [incident] = await tx.insert(incidents).values({
        incidentNumber,
        title: dto.title || type.name,
        description: dto.description,
        category: dto.category as any,
        lineId: dto.lineId,
        stationId: dto.stationId,
        incidentTypeId: dto.incidentTypeId,
        priority: priority as any,
        status: 'OPEN',
        reportedBy: userId,
        assignedTo: dto.assignedTo,
        openedAt,
        productionImpact,
        downtimeLogId,
      }).returning();

      await tx.insert(incidentHistory).values({
        incidentId: incident.id,
        actorId: userId,
        action: 'CREATED',
        toStatus: 'OPEN',
        payload: dto,
      });

      if (dto.assignedTo) {
        await tx.insert(incidentAssignments).values({
          incidentId: incident.id,
          assignedTo: dto.assignedTo,
          assignedBy: userId,
        });
      }

      if (dto.beforeImageUrl) {
        await tx.insert(incidentAttachments).values({
          incidentId: incident.id,
          uploadedBy: userId,
          kind: 'BEFORE',
          fileUrl: dto.beforeImageUrl,
        });
      }

      return incident;
    });

    await this.logAudit(userId, 'INCIDENT_CREATED', 'incidents', created.id, { incidentNumber, priority, productionImpact });
    await this.notifyIncident(created, type.name);
    await this.eventsService.emitNotification({
      type: 'INCIDENT_UPDATED',
      title: `Incident ${created.incidentNumber}`,
      message: created.title,
      severity: created.priority === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
    });
    return created;
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateIncidentDto) {
    await this.requireManagerOrAdmin(roles);
    const [updated] = await db.update(incidents)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Incident not found');
    await this.addHistory(id, userId, 'UPDATED', undefined, undefined, dto);
    return updated;
  }

  async updateStatus(id: string, userId: string, roles: string[], dto: StatusIncidentDto) {
    const [current] = await db.select({
      incident: incidents,
      type: incidentTypes,
    })
      .from(incidents)
      .innerJoin(incidentTypes, eq(incidents.incidentTypeId, incidentTypes.id))
      .where(eq(incidents.id, id))
      .limit(1);
    if (!current) throw new NotFoundException('Incident not found');

    const incident = current.incident;
    const type = current.type;

    if (dto.status === 'RESOLVED' && this.isOperator(roles) && !this.isManagerOrAdmin(roles)) {
      if (!type.selfResolvable || incident.reportedBy !== userId || incident.category === 'FACTORY' || incident.priority === 'CRITICAL') {
        throw new ForbiddenException('This incident requires manager/admin resolution');
      }
    } else if (dto.status !== 'RESOLVED' && this.isOperator(roles) && !this.isManagerOrAdmin(roles)) {
      throw new ForbiddenException('Operators can only resolve self-resolvable incidents');
    }

    if (dto.status === 'CLOSED') {
      await this.requireManagerOrAdmin(roles);
    }

    const now = new Date();
    const patch: any = { status: dto.status as any, updatedAt: now };
    if (dto.status === 'ACKNOWLEDGED') {
      patch.acknowledgedBy = userId;
      patch.acknowledgedAt = now;
    }
    if (dto.status === 'IN_PROGRESS' && !incident.acknowledgedAt) {
      patch.acknowledgedBy = userId;
      patch.acknowledgedAt = now;
    }
    if (dto.status === 'RESOLVED') {
      patch.resolvedBy = userId;
      patch.resolvedAt = now;
      patch.durationMinutes = Math.max(0, Math.round((now.getTime() - incident.openedAt.getTime()) / 60000));
      patch.rootCause = dto.rootCause ?? incident.rootCause;
      patch.correctiveAction = dto.correctiveAction ?? incident.correctiveAction;
      patch.preventiveAction = dto.preventiveAction ?? incident.preventiveAction;
    }
    if (dto.status === 'CLOSED') {
      patch.closedBy = userId;
      patch.closedAt = now;
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(incidents).set(patch).where(eq(incidents.id, id)).returning();

      if (dto.status === 'RESOLVED' && incident.productionImpact && incident.downtimeLogId) {
        await tx.update(downtimeLogs)
          .set({
            endTime: now,
            durationMinutes: patch.durationMinutes,
            updatedAt: now,
          })
          .where(eq(downtimeLogs.id, incident.downtimeLogId));
      }

      await tx.insert(incidentHistory).values({
        incidentId: id,
        actorId: userId,
        action: `STATUS_${dto.status}`,
        fromStatus: incident.status as any,
        toStatus: dto.status as any,
        payload: dto,
      });
      return row;
    });

    await this.logAudit(userId, `INCIDENT_${dto.status}`, 'incidents', id, dto);
    return updated;
  }

  async addComment(id: string, userId: string, comment: string) {
    const [row] = await db.insert(incidentComments).values({ incidentId: id, authorId: userId, comment }).returning();
    await this.addHistory(id, userId, 'COMMENT_ADDED', undefined, undefined, { comment });
    return row;
  }

  async addAttachment(id: string, userId: string, dto: AttachmentDto) {
    const [row] = await db.insert(incidentAttachments).values({
      incidentId: id,
      uploadedBy: userId,
      kind: dto.kind || 'EVIDENCE',
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
    }).returning();
    await this.addHistory(id, userId, 'ATTACHMENT_ADDED', undefined, undefined, { kind: row.kind, fileName: row.fileName });
    return row;
  }

  async remove(id: string, userId: string, roles: string[]) {
    await this.requireAdmin(roles);
    await db.update(incidents).set({ deletedAt: new Date(), deletedBy: userId }).where(eq(incidents.id, id));
    await this.logAudit(userId, 'INCIDENT_DELETED', 'incidents', id, {});
    return { success: true };
  }

  async analytics(query: any = {}) {
    await this.ensureDefaultTypes();
    const from = query.from ? new Date(query.from) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = query.to ? new Date(query.to) : new Date();
    const baseConditions = [isNull(incidents.deletedAt), gte(incidents.openedAt, from), lte(incidents.openedAt, to)];
    if (query.lineId) baseConditions.push(eq(incidents.lineId, query.lineId));
    if (query.stationId) baseConditions.push(eq(incidents.stationId, query.stationId));

    const [summary] = await db.select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where ${incidents.status} in ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'))`,
      critical: sql<number>`count(*) filter (where ${incidents.priority} = 'CRITICAL')`,
      factory: sql<number>`count(*) filter (where ${incidents.category} = 'FACTORY')`,
      downtime: sql<number>`coalesce(sum(${incidents.durationMinutes}), 0)`,
      avgResolution: sql<number>`coalesce(avg(${incidents.durationMinutes}), 0)`,
    }).from(incidents).where(and(...baseConditions));

    const maintenanceRows = await db.select({
      typeName: incidentTypes.name,
      occurrences: sql<number>`count(*)`,
      totalDowntime: sql<number>`coalesce(sum(${incidents.durationMinutes}), 0)`,
      averageDuration: sql<number>`coalesce(avg(${incidents.durationMinutes}), 0)`,
      fastest: sql<number>`coalesce(min(${incidents.durationMinutes}), 0)`,
      slowest: sql<number>`coalesce(max(${incidents.durationMinutes}), 0)`,
    })
      .from(incidents)
      .innerJoin(incidentTypes, eq(incidents.incidentTypeId, incidentTypes.id))
      .where(and(...baseConditions, inArray(incidentTypes.name, ['Ink Change', 'Make-up Change', 'Label Roll Change'])))
      .groupBy(incidentTypes.name);

    return { summary, maintenance: maintenanceRows };
  }

  private validateScope(category: string, lineId?: string, stationId?: string) {
    if (category === 'LINE' && !lineId) throw new BadRequestException('Line is required for line incidents');
    if (category === 'STATION' && (!lineId || !stationId)) throw new BadRequestException('Line and station are required for station incidents');
  }

  private async nextIncidentNumber() {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const [count] = await db.select({ value: sql<number>`count(*)` }).from(incidents).where(sql`${incidents.incidentNumber} like ${`INC-${stamp}-%`}`);
    return `INC-${stamp}-${String(Number(count?.value || 0) + 1).padStart(4, '0')}`;
  }

  private async addHistory(incidentId: string, userId: string, action: string, fromStatus?: any, toStatus?: any, payload?: any) {
    await db.insert(incidentHistory).values({ incidentId, actorId: userId, action, fromStatus, toStatus, payload });
  }

  private async logAudit(userId: string, action: string, entityType: string, entityId: string, payload: any) {
    await db.insert(auditLogs).values({ actorId: userId, action, entityType, entityId, category: 'MAINTENANCE', payload });
  }

  private async notifyIncident(incident: any, typeName: string) {
    const severity = incident.priority === 'CRITICAL' ? 'CRITICAL' : incident.priority === 'LOW' ? 'INFO' : 'WARNING';
    await this.notificationsService.createNotification(
      'INCIDENT',
      `${incident.priority} Incident: ${typeName}`,
      `${incident.incidentNumber} - ${incident.title}`,
      severity,
      `incident:${incident.id}:${incident.status}`,
    );
  }

  private isOperator(roles: string[]) {
    return roles.includes('OPERATOR');
  }

  private isManagerOrAdmin(roles: string[]) {
    return roles.includes('ADMIN') || roles.includes('MANAGER');
  }

  private async requireManagerOrAdmin(roles: string[]) {
    if (!this.isManagerOrAdmin(roles)) throw new ForbiddenException('Manager/Admin access required');
  }

  private async requireAdmin(roles: string[]) {
    if (!roles.includes('ADMIN')) throw new ForbiddenException('Admin access required');
  }
}
