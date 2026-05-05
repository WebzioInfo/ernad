import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { db } from '../db/db';
import { users, roles, userRoles, auditLogs, userLines } from '../db/schema';
import { eq, ilike, asc, sql, or, desc } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  
  constructor(
    private readonly mailService: MailService,
    private readonly mediaService: MediaService,
  ) {}

  /**
   * Get all operators — excludes password field for safety.
   */
  async getAllOperators() {
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
      .orderBy(asc(users.name));

    // Fetch roles and assigned lines for each user
    const usersWithData = await Promise.all(rows.map(async (user) => {
      const userRolesResult = await db.select({
        slug: roles.slug
      })
      .from(roles)
      .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

      const userLinesResult = await db.select({
        lineId: userLines.lineId
      })
      .from(userLines)
      .where(eq(userLines.userId, user.id));
      
      return { 
        ...user, 
        roles: userRolesResult.map(r => r.slug),
        assignedLines: userLinesResult.map(l => l.lineId)
      };
    }));

    return usersWithData;
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
  async getOperatorById(id: string) {
    const user = await this.getOperatorWithContext(id);
    if (!user) {
      throw new NotFoundException(`Operator with id "${id}" not found`);
    }
    return user;
  }

  /**
   * Create a new operator with a bcrypt-hashed PIN.
   */
  async createOperator(dto: any) {
    if (!dto.name || !dto.username || !dto.pin) {
      throw new BadRequestException('name, username, and pin are required');
    }

    return await db.transaction(async (tx) => {
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
  }

  /**
   * Update operator details.
   */
  async updateOperator(id: string, dto: any) {
    this.logger.log(`[UsersService] Updating operator ${id} with DTO: ${JSON.stringify(dto)}`);
    try {
      return await db.transaction(async (tx) => {
        const existing = await tx.select().from(users).where(eq(users.id, id));
        if (!existing[0]) throw new NotFoundException(`User not found`);

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
          updateData.pinCode = await bcrypt.hash(dto.pin, 10);
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
    } catch (error: any) {
      this.logger.error(`Failed to update operator ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Toggle operator active/inactive status.
   */
  async toggleActive(id: string) {
    const rows = await db
      .select({ id: users.id, isActive: users.isActive, name: users.name })
      .from(users)
      .where(eq(users.id, id));

    if (!rows[0]) {
      throw new NotFoundException(`Operator with id "${id}" not found`);
    }

    const newStatus = !rows[0].isActive;

    await db
      .update(users)
      .set({ isActive: newStatus })
      .where(eq(users.id, id));

    return {
      message: `Operator "${rows[0].name}" has been ${newStatus ? 'activated' : 'deactivated'}.`,
      isActive: newStatus,
    };
  }

  /**
   * Reset operator PIN by ID (bcrypt hashed).
   */
  async resetPin(id: string, newPin: string) {
    if (!newPin || newPin.length < 4) {
      throw new BadRequestException('PIN must be at least 4 characters');
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

    return { message: `PIN for "${rows[0].name}" has been reset successfully.` };
  }

  /**
   * Delete an operator (soft-delete by setting isActive = false preferred in production).
   */
  async deleteOperator(id: string) {
    const rows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, id));

    if (!rows[0]) {
      throw new NotFoundException(`Operator with id "${id}" not found`);
    }

    await db.delete(users).where(eq(users.id, id));

    return { message: `Operator "${rows[0].name}" has been deleted.` };
  }

  async getAuditLogs() {
    return await db.select({
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
}
