import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../db/db';
import { users } from '../db/schema';
import { eq, ilike, asc, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { MediaService } from '../media/media.service';

export interface CreateOperatorDto {
  name: string;
  username: string;
  email: string;
  phoneNumber?: string;
  department?: string;
  jobTitle?: string;
  pin: string;
  role: string;
  operatorType?: string;
}

export interface UpdateOperatorDto {
  name?: string;
  email?: string;
  phoneNumber?: string;
  department?: string;
  jobTitle?: string;
  role?: string;
  operatorType?: string;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
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
        role: users.role,
        operatorType: users.operatorType,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.name));

    return rows;
  }

  /**
   * Get a single operator by ID — excludes password.
   */
  async getOperatorById(id: string) {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
        operatorType: users.operatorType,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));

    if (!rows[0]) {
      throw new NotFoundException(`Operator with id "${id}" not found`);
    }

    return rows[0];
  }

  /**
   * Create a new operator with a bcrypt-hashed PIN.
   */
  async createOperator(dto: CreateOperatorDto) {
    if (!dto.name || !dto.username || !dto.pin) {
      throw new BadRequestException('name, username, and pin are required');
    }

    if (dto.pin.length < 4) {
      throw new BadRequestException('PIN must be at least 4 characters');
    }

    // Check for duplicate username or email
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`${users.username} = ${dto.username} OR ${users.email} = ${dto.email}`);

    if (existing.length > 0) {
      throw new ConflictException(`Username "${dto.username}" already exists`);
    }

    const hashedPin = await bcrypt.hash(dto.pin, 10);

    const [created] = await db
      .insert(users)
      .values({
        name: dto.name,
        username: dto.username,
        email: dto.email,
        phoneNumber: dto.phoneNumber || null,
        department: dto.department || null,
        jobTitle: dto.jobTitle || null,
        pinCode: hashedPin,
        role: dto.role as any,
        operatorType: dto.operatorType || null,
        isActive: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        jobTitle: users.jobTitle,
        department: users.department,
        role: users.role,
        operatorType: users.operatorType,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    // ─── Dispatched Welcome Identity Email ───
    await this.mailService.sendWelcomeEmail(created.email, created.name, created.username, dto.pin);

    return created;
  }

  /**
   * Update operator details (name, role, operatorType, isActive).
   */
  async updateOperator(id: string, dto: UpdateOperatorDto) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id));

    if (!existing[0]) {
      throw new NotFoundException(`Operator with id "${id}" not found`);
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(dto.name && { name: dto.name }),
        ...(dto.email && { email: dto.email }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.role && { role: dto.role as any }),
        ...(dto.operatorType !== undefined && { operatorType: dto.operatorType }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        jobTitle: users.jobTitle,
        department: users.department,
        role: users.role,
        operatorType: users.operatorType,
        isActive: users.isActive,
      });

    return updated;
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
