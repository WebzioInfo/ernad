import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { db } from '../../database/db';
import { users, roles, userRoles, auditLogs, userLines } from '../../database/schema';
import { eq, ilike, asc, sql, or, desc, inArray, notInArray, and } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../../providers/mail/mail.service';
import { MediaService } from '../../providers/media/media.service';
import { RedisService } from '../../providers/redis/redis.service';
import { ProductionEventsService } from '../../realtime/production.gateway';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  
  constructor(
    private readonly mailService: MailService,
    private readonly mediaService: MediaService,
    private readonly redisService: RedisService,
    private readonly eventsService: ProductionEventsService,
  ) {}

  /**
   * Privileged role slugs that managers must NEVER see.
   * Updated here to keep the deny-list in one place.
   */
  private static readonly PRIVILEGED_ROLES = [
    'ADMIN',
  ] as const;

  private static readonly VALID_ROLE_SLUGS = ['ADMIN', 'MANAGER', 'OPERATOR'] as const;

  /**
   * Get all users — role-scoped with filtering and pagination.
   */
  async getAllOperators(callerId: string, callerRoles: string[] = [], queryParams?: any) {
    const isAdmin = callerRoles.includes('ADMIN');
    const isManager = callerRoles.includes('MANAGER');

    const {
      search,
      role,
      department,
      isActive,
      page = 1,
      limit = 50
    } = queryParams || {};

    const offset = (page - 1) * limit;

    // 1. Determine Hierarchy Filters
    let hiddenRoleSlugs: string[] = [];
    let isSelfOnly = false;

    if (isAdmin) {
      hiddenRoleSlugs = [];
    } else if (isManager) {
      // MANAGER: Must ONLY see OPERATORs. Exclude both ADMIN and MANAGER roles.
      hiddenRoleSlugs = ['admin', 'manager', 'ADMIN', 'MANAGER'];
    } else {
      // OPERATOR or other roles: only see themselves
      isSelfOnly = true;
    }

    // 2. Build Query Conditions
    const conditions: any[] = [sql`1=1` ]; // Base condition

    if (isSelfOnly) {
      conditions.push(eq(users.id, callerId));
    }

    if (hiddenRoleSlugs.length > 0) {
      // Exclude users who have ANY of the hidden roles
      const privilegedUserRoles = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(inArray(roles.slug, hiddenRoleSlugs));

      const privilegedUserIds = privilegedUserRoles.map(pur => pur.userId);
      if (privilegedUserIds.length > 0) {
        conditions.push(notInArray(users.id, privilegedUserIds));
      }
    }

    // Apply Search
    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.username, `%${search}%`)
        )
      );
    }

    // Apply Filters
    if (department && department !== 'ALL') {
      conditions.push(eq(users.department, department));
    }

    if (isActive !== undefined) {
      const activeBool = isActive === 'true' || isActive === true;
      conditions.push(eq(users.isActive, activeBool));
    }

    // Note: Role filter is tricky because a user can have multiple roles.
    // If a role filter is requested, we join userRoles/roles in the main query.
    if (role && role !== 'ALL') {
      const roleSubquery = db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(ilike(roles.slug, role));
      
      conditions.push(inArray(users.id, roleSubquery));
    }

    // 3. Execute Count and Data Fetch
    const [totalRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${sql.join(conditions, sql` AND `)}`);

    const total = Number(totalRes?.count || 0);

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        department: users.department,
        jobTitle: users.jobTitle,
        avatarUrl: users.avatarUrl,
        operatorType: users.operatorType,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${sql.join(conditions, sql` AND `)}`)
      .orderBy(asc(users.name))
      .limit(limit)
      .offset(offset);

    // 4. Attach roles and lines in bulk queries (avoiding N+1 roundtrips)
    let usersWithData = rows.map(user => ({
      ...user,
      roles: [] as string[],
      assignedLines: [] as string[]
    }));

    if (rows.length > 0) {
      const userIds = rows.map(u => u.id);

      // Fetch all roles for all fetched users in a single query
      const allUserRoles = await db
        .select({
          userId: userRoles.userId,
          slug: roles.slug
        })
        .from(roles)
        .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, userIds));

      // Fetch all assigned lines for all fetched users in a single query
      const allUserLines = await db
        .select({
          userId: userLines.userId,
          lineId: userLines.lineId
        })
        .from(userLines)
        .where(inArray(userLines.userId, userIds));

      // Group roles by userId
      const rolesByUserId = allUserRoles.reduce((acc, curr) => {
        if (!acc[curr.userId]) acc[curr.userId] = [];
        acc[curr.userId].push(curr.slug);
        return acc;
      }, {} as Record<string, string[]>);

      // Group lines by userId
      const linesByUserId = allUserLines.reduce((acc, curr) => {
        if (!acc[curr.userId]) acc[curr.userId] = [];
        acc[curr.userId].push(curr.lineId);
        return acc;
      }, {} as Record<string, string[]>);

      usersWithData = rows.map((user) => ({
        ...user,
        roles: rolesByUserId[user.id] || [],
        assignedLines: linesByUserId[user.id] || [],
      }));
    }

    return {
      data: usersWithData,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Internal helper to get operator with a specific DB/TX context
   */
  private async getOperatorWithContext(id: string, client: any = db) {
    const rows = await client
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        department: users.department,
        jobTitle: users.jobTitle,
        avatarUrl: users.avatarUrl,
        operatorType: users.operatorType,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!rows[0]) return null;

    const userRolesResult = await client.select({
      slug: roles.slug
    })
    .from(roles)
    .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, rows[0].id));

    const userLinesResult = await client.select({
      lineId: sql<string>`${userLines.lineId}`
    })
    .from(userLines)
    .where(eq(userLines.userId, rows[0].id));

    return { 
      ...rows[0], 
      roles: userRolesResult.map((r: any) => r.slug),
      assignedLines: userLinesResult.map((l: any) => l.lineId)
    };
  }

  /**
   * Get a single operator by ID — excludes password.
   */
  async getOperatorById(id: string, callerId: string, callerRoles: string[] = []) {
    const isAdmin      = callerRoles.includes('ADMIN');
    const isManager    = callerRoles.includes('MANAGER');

    const user = await this.getOperatorWithContext(id);
    if (!user) {
      throw new NotFoundException(`Operator with id "${id}" not found`);
    }

    // Operator: Only sees themselves
    if (!isAdmin && !isManager) {
      if (id !== callerId) {
        throw new ForbiddenException('You can only access your own profile');
      }
      return user;
    }

    if (isAdmin) {
      return user;
    }

    // Manager: Cannot see Admin or above
    if (isManager) {
      const isPrivileged = user.roles.some(r => UsersService.PRIVILEGED_ROLES.includes(r as any));
      if (isPrivileged) {
        throw new ForbiddenException('You do not have permission to view administrative accounts');
      }
      return user;
    }

    return user;
  }

  /**
   * Create a new staff member with a bcrypt-hashed PIN.
   * Admins can assign all supported roles; managers can create operators.
   */
  async createOperator(actorRoles: string[], dto: any) {
    if (!dto.name || !dto.username || !dto.pin) {
      throw new BadRequestException('name, username, and pin are required');
    }

    if (String(dto.pin).length !== 4) {
      throw new BadRequestException('Operator PIN must be exactly 4 digits');
    }

    const normalizedActorRoles = actorRoles.map((role) => String(role).toUpperCase());
    const isAdmin = normalizedActorRoles.includes('ADMIN');
    const isManager = normalizedActorRoles.includes('MANAGER');

    if (!isAdmin && !isManager) {
      throw new ForbiddenException('You do not have permission to create users');
    }

    // Role Hierarchy Validation
    const requestedRoles = (dto.roles || [dto.role]).filter(Boolean).map((r: string) => r.toUpperCase());
    const invalidRole = requestedRoles.find(r => !UsersService.VALID_ROLE_SLUGS.includes(r as any));
    if (invalidRole) {
      throw new BadRequestException(`Invalid role "${invalidRole}". Allowed roles are ADMIN, MANAGER, OPERATOR`);
    }
    if (!isAdmin && requestedRoles.some(r => r !== 'OPERATOR')) {
      throw new ForbiddenException('Managers can only create operator staff accounts');
    }

    const createdUser = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`${users.username} = ${dto.username} OR ${users.email} = ${dto.email}`);

      if (existing.length > 0) {
        throw new ConflictException(`Username or Email already exists`);
      }

      const hashedPin = await bcrypt.hash(dto.pin, 10);

      const [created] = await tx
        .insert(users)
        .values({
          name: dto.name,
          username: dto.username,
          email: dto.email,
          phoneNumber: dto.phoneNumber || null,
          department: dto.department || null,
          jobTitle: dto.jobTitle || null,
          pinCode: hashedPin,
          operatorType: dto.operatorType || null,
          isActive: true,
        })
        .returning();

      // Assign roles
      if (dto.roles && Array.isArray(dto.roles)) {
        for (const rawRoleSlug of dto.roles) {
          const roleSlug = String(rawRoleSlug).trim().toUpperCase();
          const [roleObj] = await tx.select().from(roles).where(ilike(roles.slug, roleSlug));
          if (roleObj) {
            await tx.insert(userRoles).values({
              userId: created.id,
              roleId: roleObj.id
            });
          }
        }
      } else if (dto.role) {
        // Legacy single role support
        const roleSlug = String(dto.role).trim().toUpperCase();
        const [roleObj] = await tx.select().from(roles).where(ilike(roles.slug, roleSlug));
        if (roleObj) {
          await tx.insert(userRoles).values({
            userId: created.id,
            roleId: roleObj.id
          });
        }
      }

      // Assign Production Lines
      const linesToAssign = Array.isArray(dto.assignedLines) ? dto.assignedLines : [];
      for (const lineId of linesToAssign) {
        if (!lineId) continue;
        await tx.insert(userLines).values({
          userId: created.id,
          lineId: lineId
        }).onConflictDoNothing();
      }

      return this.getOperatorWithContext(created.id, tx);
    });

    await this.eventsService.emitDataChanged('users', { action: 'created', id: createdUser?.id });
    return createdUser;
  }

  /**
   * Update operator details.
   * STRICT: Hierarchy check to prevent role elevation by non-admins.
   */
  async updateOperator(callerId: string, callerRoles: string[], id: string, dto: any) {
    this.logger.log(`[UsersService] Updating operator ${id} with DTO: ${JSON.stringify(dto)}`);
    
    const isAdmin = callerRoles.includes('ADMIN');

    if (!isAdmin && !callerRoles.includes('MANAGER')) {
      throw new ForbiddenException('You do not have permission to update users');
    }
    try {
      const updatedUser = await db.transaction(async (tx) => {
        // RED TEAM FIX: Implement hierarchical validation before update
        const existing = await this.getOperatorById(id, callerId, callerRoles);
        if (!existing) throw new NotFoundException(`User not found`);
        
        // getOperatorById already throws Forbidden if hierarchy is violated.

        const updateData: any = {
          ...(dto.name && { name: dto.name }),
          ...(dto.username && { username: dto.username }),
          ...(dto.email && { email: dto.email }),
          ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
          ...(dto.department !== undefined && { department: dto.department }),
          ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
          ...(dto.operatorType !== undefined && { operatorType: dto.operatorType }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        };

        if (dto.pin) {
          if (String(dto.pin).length !== 4) {
            throw new BadRequestException('Operator PIN must be exactly 4 digits');
          }
          updateData.pinCode = await bcrypt.hash(dto.pin, 10);
        }

        // Hierarchy validation for role updates
        if (dto.roles || dto.role) {
          const requestedRoles = (dto.roles || [dto.role]).filter(Boolean).map((r: string) => r.toUpperCase());
          const invalidRole = requestedRoles.find(r => !UsersService.VALID_ROLE_SLUGS.includes(r as any));
          if (invalidRole) {
            throw new BadRequestException(`Invalid role "${invalidRole}". Allowed roles are ADMIN, MANAGER, OPERATOR`);
          }
          if (!isAdmin) {
            const hasNonOperatorRole = requestedRoles.some(r => r !== 'OPERATOR');
            if (hasNonOperatorRole) {
              throw new ForbiddenException('Only admins can assign Admin/Manager roles');
            }
          }
        }

        await tx.update(users).set(updateData).where(eq(users.id, id));

        if (dto.roles && Array.isArray(dto.roles)) {
          this.logger.log(`[TX] Updating roles for user ${id}. New roles: ${JSON.stringify(dto.roles)}`);
          // Refresh roles
          await tx.delete(userRoles).where(eq(userRoles.userId, id));
          for (const rawRoleSlug of dto.roles) {
            const roleSlug = String(rawRoleSlug).trim().toUpperCase();
            const [roleObj] = await tx.select().from(roles).where(ilike(roles.slug, roleSlug));
            if (roleObj) {
              this.logger.log(`[TX] Assigning role ${roleSlug} (ID: ${roleObj.id}) to user ${id}`);
              await tx.insert(userRoles).values({ userId: id, roleId: roleObj.id });
            } else {
              this.logger.warn(`[TX] Role slug NOT FOUND in DB: "${roleSlug}"`);
            }
          }
        } else if (dto.role) {
          this.logger.log(`[TX] Updating legacy role for user ${id}. New role: ${dto.role}`);
          await tx.delete(userRoles).where(eq(userRoles.userId, id));
          const [roleObj] = await tx.select().from(roles).where(eq(roles.slug, dto.role));
          if (roleObj) {
            await tx.insert(userRoles).values({ userId: id, roleId: roleObj.id });
          }
        }

        // Sync Production Lines
        const linesToAssign = Array.isArray(dto.assignedLines) ? dto.assignedLines : [];
        this.logger.log(`[TX] Syncing ${linesToAssign.length} lines for user ${id}`);
        
        await tx.delete(userLines).where(eq(userLines.userId, id));
        for (const lineId of linesToAssign) {
          if (!lineId) continue;
          await tx.insert(userLines).values({
            userId: id,
            lineId: lineId
          }).onConflictDoNothing();
        }

        return this.getOperatorWithContext(id, tx);
      });
      await this.eventsService.emitDataChanged('users', { action: 'updated', id });
      return updatedUser;
    } catch (error: any) {
      this.logger.error(`Failed to update operator ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Toggle operator active/inactive status.
   */
  async toggleActive(id: string, callerId: string, callerRoles: string[] = []) {
    // RED TEAM FIX: Implement hierarchical validation before toggle
    const existing = await this.getOperatorById(id, callerId, callerRoles);
    if (!existing) throw new NotFoundException(`User not found`);

    const newStatus = !existing.isActive;

    await db
      .update(users)
      .set({ isActive: newStatus })
      .where(eq(users.id, id));

    // RED TEAM FIX: Invalidate auth cache immediately on status change
    await this.redisService.del(`user:status:${id}`);
    await this.eventsService.emitDataChanged('users', { action: 'status_changed', id });

    return {
      message: `Operator "${existing.name}" has been ${newStatus ? 'activated' : 'deactivated'}.`,
      isActive: newStatus,
    };
  }

  /**
   * Reset operator PIN by ID (bcrypt hashed).
   */
  async resetPin(id: string, newPin: string) {
    if (!newPin || String(newPin).length !== 4) {
      throw new BadRequestException('PIN must be exactly 4 digits');
    }

    const rows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, id));

    if (!rows[0]) {
      throw new NotFoundException(`Operator with id "${id}" not found`);
    }

    const hashed = await bcrypt.hash(newPin, 10);

    await db
      .update(users)
      .set({ pinCode: hashed })
      .where(eq(users.id, id));
    await this.eventsService.emitDataChanged('users', { action: 'pin_reset', id });

    return { message: `PIN for "${rows[0].name}" has been reset successfully.` };
  }

  /**
   * Delete an operator (Soft-delete).
   */
  async deleteOperator(id: string) {
    const rows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, id));

    if (!rows[0]) {
      throw new NotFoundException(`Operator with id "${id}" not found`);
    }

    await db.update(users).set({ 
      isActive: false, 
      deletedAt: new Date(),
      username: sql`${users.username} || '_deleted_' || ${id.slice(0, 8)}`,
      email: sql`${users.email} || '_deleted_' || ${id.slice(0, 8)}`
    }).where(eq(users.id, id));
    await this.eventsService.emitDataChanged('users', { action: 'deleted', id });

    return { message: `Operator "${rows[0].name}" has been soft-deleted.` };
  }

  async getUserAuditLogs(userId: string, callerRoles: string[] = []) {
    try {
      const isAdmin = callerRoles.includes('ADMIN');

      // If not Admin, verify target user is not privileged
      if (!isAdmin) {
        const targetUser = await this.getOperatorWithContext(userId);
        if (targetUser) {
          const isPrivileged = targetUser.roles.some(r => UsersService.PRIVILEGED_ROLES.includes(r as any));
          if (isPrivileged) {
            throw new ForbiddenException('You do not have permission to view audit logs for privileged system accounts');
          }
        }
      }

      return await db.select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        category: auditLogs.category,
        payload: auditLogs.payload,
        occurredAt: auditLogs.occurredAt,
      })
        .from(auditLogs)
        .where(eq(auditLogs.actorId, userId))
        .orderBy(desc(auditLogs.occurredAt))
        .limit(20);
    } catch (error) {
      this.logger.error(`[AUDIT_LOG_FETCH_FAILED] for user ${userId}:`, error);
      return []; // Degrade gracefully, return empty list on failure
    }
  }

  async getAuditLogs(callerRoles: string[] = []) {
    const isAdmin = callerRoles.includes('ADMIN');

    // If not Admin, we must filter out privileged accounts from audit logs
    let excludedUserIds: string[] = [];
    
    if (!isAdmin) {
      const privilegedRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.slug, UsersService.PRIVILEGED_ROLES));
      
      if (privilegedRoles.length > 0) {
        const privilegedUserRoles = await db
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(inArray(userRoles.roleId, privilegedRoles.map(r => r.id)));
        
        excludedUserIds = privilegedUserRoles.map(pur => pur.userId);
      }
    }

    let query = db.select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      occurredAt: auditLogs.occurredAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .$dynamic();

    if (excludedUserIds.length > 0) {
      query = query.where(notInArray(auditLogs.actorId, excludedUserIds));
    }

    return await query
      .orderBy(desc(auditLogs.occurredAt))
      .limit(50);
  }

  /**
   * Update personnel avatar using a Cloudinary-hosted image.
   */
  async updateAvatar(id: string, file: any) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id));

    if (!existing[0]) {
      throw new NotFoundException(`Personnel with id "${id}" not found`);
    }

    const secureUrl = await this.mediaService.uploadAvatar(file.buffer);

    await db
      .update(users)
      .set({ avatarUrl: secureUrl })
      .where(eq(users.id, id));

    return { 
      message: 'Profile image updated successfully',
      avatarUrl: secureUrl 
    };
  }

  async getTerminalOperators() {
    this.logger.log('[CONNECTIVITY_TRACE] Fetching terminal operators list...');
    try {
      // Find IDs of users with privileged roles — exclude them from terminal lists
      const privilegedRoleRows = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.slug, [...UsersService.PRIVILEGED_ROLES]));

      let excludedIds: string[] = [];
      if (privilegedRoleRows.length > 0) {
        const rows = await db
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(inArray(userRoles.roleId, privilegedRoleRows.map(r => r.id)));
        excludedIds = rows.map(r => r.userId);
      }

      let query = db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          jobTitle: users.jobTitle,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.isActive, true))
        .$dynamic();

      if (excludedIds.length > 0) {
        query = query.where(notInArray(users.id, excludedIds));
      }

      const operatorList = await query.orderBy(asc(users.name));
      this.logger.log(`[CONNECTIVITY_SUCCESS] Retrieved ${operatorList.length} operators (privileged excluded).`);
      return operatorList;
    } catch (error: any) {
      this.logger.error(`[CONNECTIVITY_FAILURE] Failed to fetch operators: ${error.message}`);
      return [];
    }
  }

  async verifySupervisorPin(pin: string) {
    if (!pin || pin.length !== 4) return null;

    // Find users with Manager or Admin roles
    const supervisorRoles = await db.select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.slug, ['MANAGER', 'ADMIN']));
    
    if (supervisorRoles.length === 0) return null;

    const supervisors = await db.select({
      id: users.id,
      pinCode: users.pinCode,
      name: users.name
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(
      eq(users.isActive, true),
      inArray(userRoles.roleId, supervisorRoles.map(r => r.id))
    ));

    for (const supervisor of supervisors) {
      if (supervisor.pinCode && await bcrypt.compare(pin, supervisor.pinCode)) {
        return supervisor;
      }
    }

    return null;
  }
}
