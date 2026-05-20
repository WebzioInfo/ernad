import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { notes, users, auditLogs } from '../../database/schema';
import { eq, and, or, inArray, desc, ilike, sql, isNull } from 'drizzle-orm';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { ProductionEventsService } from '../../realtime/production.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private readonly eventsService: ProductionEventsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getHierarchyRoles(role: string): string[] {
    const r = role.toUpperCase();
    if (r === 'SUPER_ADMIN') return []; // Special case: see all
    if (r === 'ADMIN') return ['ADMIN', 'MANAGER', 'OPERATOR'];
    if (r === 'MANAGER') return ['MANAGER', 'OPERATOR'];
    return []; // Operators only see their own
  }

  async create(userId: string, userRole: string, dto: CreateNoteDto) {
    const [note] = await db.insert(notes).values({
      ...dto,
      createdById: userId,
      createdByRole: userRole,
    }).returning();

    // Audit Log
    await db.insert(auditLogs).values({
      actorId: userId,
      action: 'CREATE_NOTE',
      entityType: 'NOTE',
      entityId: note.id,
      payload: { title: note.title, type: note.type },
    });

    // Realtime Event
    await this.eventsService.emitNotification({
      type: 'NOTE_CREATED',
      title: 'New Note Created',
      message: `${note.title} by ${userRole}`,
      severity: note.priority === 'CRITICAL' ? 'CRITICAL' : 'INFO',
    });

    // OneSignal for Critical/Incident
    if (note.priority === 'CRITICAL' || ['INCIDENT', 'BREAKDOWN', 'SHIFT_HANDOVER'].includes(note.type)) {
      await this.notificationsService.createNotification(
        note.type,
        `[${note.type}] ${note.title}`,
        note.content.substring(0, 100),
        note.priority === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        `note:${note.id}`
      );
    }

    return note;
  }

  async findAll(userId: string, userRole: string, filters: any) {
    const roleHierarchy = this.getHierarchyRoles(userRole);
    let conditions = and(isNull(notes.deletedAt));

    // Hierarchical Visibility
    if (userRole.toUpperCase() === 'SUPER_ADMIN') {
      // Sees everything
    } else if (['ADMIN', 'MANAGER'].includes(userRole.toUpperCase())) {
      conditions = and(conditions, inArray(notes.createdByRole, roleHierarchy));
    } else {
      // Operators see logs contextually based on line/batch filters
      // So no restrictive conditions here!
    }

    // Apply Filters
    if (filters.type) conditions = and(conditions, eq(notes.type, filters.type));
    if (filters.priority) conditions = and(conditions, eq(notes.priority, filters.priority));
    if (filters.lineId) conditions = and(conditions, eq(notes.lineId, filters.lineId));
    if (filters.isPinned !== undefined) conditions = and(conditions, eq(notes.isPinned, filters.isPinned === 'true'));
    if (filters.search) conditions = and(conditions, or(ilike(notes.title, `%${filters.search}%`), ilike(notes.content, `%${filters.search}%`)));

    return await db.select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      type: notes.type,
      priority: notes.priority,
      createdById: notes.createdById,
      createdByRole: notes.createdByRole,
      createdByName: users.name,
      lineId: notes.lineId,
      isPinned: notes.isPinned,
      isArchived: notes.isArchived,
      attachments: notes.attachments,
      tags: notes.tags,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .leftJoin(users, eq(notes.createdById, users.id))
    .where(conditions)
    .orderBy(desc(notes.isPinned), desc(notes.createdAt))
    .limit(filters.limit ? parseInt(filters.limit) : 50)
    .offset(filters.offset ? parseInt(filters.offset) : 0);
  }

  async findOne(id: string, userId: string, userRole: string) {
    const [note] = await db.select().from(notes).where(eq(notes.id, id));
    if (!note) throw new NotFoundException('Note not found');

    // Visibility Check
    // Context-based viewing: all authenticated factory users can read a specific note if they have its ID
    // (Actual contextual filtering happens in findAll). We allow read here.

    return note;
  }

  async update(id: string, userId: string, userRole: string, dto: UpdateNoteDto) {
    const note = await this.findOne(id, userId, userRole);
    
    // Only owner or higher hierarchy can edit? 
    // Usually only owner can edit content, but admin can pin/archive.
    const isOwner = note.createdById === userId;
    const isHigher = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole.toUpperCase()) && this.getHierarchyRoles(userRole).includes(note.createdByRole);

    if (!isOwner && !isHigher) {
       throw new ForbiddenException('You cannot edit this note');
    }

    const [updated] = await db.update(notes)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();

    return updated;
  }

  async remove(id: string, userId: string, userRole: string) {
    const note = await this.findOne(id, userId, userRole);
    
    const isOwner = note.createdById === userId;
    const isSuperAdmin = userRole.toUpperCase() === 'SUPER_ADMIN';

    if (!isOwner && !isSuperAdmin) {
      throw new ForbiddenException('Only the owner or Super Admin can delete notes');
    }

    await db.update(notes).set({ deletedAt: new Date() }).where(eq(notes.id, id));
    return { success: true };
  }
}
