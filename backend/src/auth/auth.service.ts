import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../db/db';
import { users, operatorSessions, roles, permissions, rolePermissions, userRoles } from '../db/schema';
import { eq, ilike, and, isNull, sql, or } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private jwtService: JwtService) {}

  async login(identity: string, credential: string, type?: 'PASSWORD' | 'PIN') {
    const trimmedIdentity = identity.trim();
    const userResult = await db.select().from(users).where(
      or(
        ilike(users.username, trimmedIdentity),
        ilike(users.email, trimmedIdentity)
      )
    );
    const user = userResult[0];

    if (!user) {
      this.logger.warn(`Login attempt failed: User not found for identity [${trimmedIdentity}]`);
      throw new UnauthorizedException('Identity signature not recognized.');
    }

    let isMatch = false;

    // ─── Intelligent Auto-Detection Logic ───
    if (type) {
      // User specified which mode to use
      if (type === 'PASSWORD') {
        if (!user.passwordHash) throw new UnauthorizedException('This account requires a PIN access.');
        isMatch = await bcrypt.compare(credential, user.passwordHash).catch(() => false);
      } else {
        if (!user.pinCode) throw new UnauthorizedException('This account requires a Password access.');
        isMatch = await bcrypt.compare(credential, user.pinCode).catch(() => false);
      }
    } else {
      // Automated Mode: Try Password first, then PIN
      if (user.passwordHash) {
        isMatch = await bcrypt.compare(credential, user.passwordHash).catch(() => false);
      }
      
      if (!isMatch && user.pinCode) {
        isMatch = await bcrypt.compare(credential, user.pinCode).catch(() => false);
      }
    }

    if (!isMatch) {
      this.logger.warn(`Login attempt failed: Credential mismatch for user [${user.username}]. Provided: ${credential.length} chars. Hash exists: ${!!user.passwordHash}, Pin exists: ${!!user.pinCode}`);
      throw new UnauthorizedException('Access credential rejected.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account deactivated.');
    }

    // ── Fetch Roles and Permissions (Phase 3 Redesign - Multi-Role Support) ──
    const userRolesResult = await db.select({
      id: roles.id,
      slug: roles.slug,
      name: roles.name,
    })
    .from(roles)
    .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

    const roleSlugs = userRolesResult.map(r => r.slug);
    
    let permissionsSlugs: string[] = [];
    if (userRolesResult.length > 0) {
      const perms = await db.select({
        slug: permissions.slug,
      })
      .from(permissions)
      .innerJoin(rolePermissions, eq(rolePermissions.permissionId, permissions.id))
      .where(or(...userRolesResult.map(r => eq(rolePermissions.roleId, r.id))));
      
      permissionsSlugs = Array.from(new Set(perms.map(p => p.slug)));
    }

    this.logger.debug(`[AuthService] User ${user.username} logged in with roles: ${roleSlugs} and permissions: ${permissionsSlugs}`);

    const payload = {
      sub: user.id,
      username: user.username,
      role: roleSlugs[0],
      roles: roleSlugs,
      permissions: permissionsSlugs,
      name: user.name,
      factoryId: user.factoryId,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: roleSlugs[0],
        roles: roleSlugs,
        permissions: permissionsSlugs,
        jobTitle: user.jobTitle,
        department: user.department,
        avatarUrl: user.avatarUrl,
        factoryId: user.factoryId,
      },
    };
  }

  async startOperatorSession(userId: string, lineId: string, shiftId: string) {
    this.logger.log(`Starting session for user ${userId} on line ${lineId}`);
    
    // Fetch user to get factoryId
    const [user] = await db.select({ factoryId: users.factoryId }).from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user || !user.factoryId) {
      throw new BadRequestException('User does not have an assigned factory.');
    }

    // Close existing open sessions for the SAME USER and SAME LINE
    await db.update(operatorSessions)
      .set({ endTime: new Date(), isActive: false, endReason: 'superseded' })
      .where(and(
        eq(operatorSessions.userId, userId), 
        eq(operatorSessions.lineId, lineId),
        eq(operatorSessions.isActive, true)
      ));

    const result = await db.insert(operatorSessions).values({
      userId,
      lineId,
      shiftId,
      factoryId: user.factoryId,
      station: 'UNKNOWN', // Legacy session
      startTime: new Date(),
      isActive: true,
    }).returning();

    return result[0];
  }

  async logoutOperatorSession(userId: string) {
    await db.update(operatorSessions)
      .set({ endTime: new Date(), isActive: false, endReason: 'manual' })
      .where(and(eq(operatorSessions.userId, userId), eq(operatorSessions.isActive, true)));
    
    return { success: true };
  }

  async resetCredentialById(adminRoles: string[], userId: string, newCredential: string, type: 'PASSWORD' | 'PIN') {
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
    const hasAccess = adminRoles?.some(r => allowedRoles.includes(r));
    
    if (!hasAccess) {
      throw new ForbiddenException('Unauthorized to reset credentials');
    }

    const hashed = await bcrypt.hash(newCredential, 10);
    const updateField = type === 'PASSWORD' ? { passwordHash: hashed } : { pinCode: hashed };

    await db.update(users)
      .set(updateField)
      .where(eq(users.id, userId));

    return { success: true, message: `${type} updated successfully` };
  }
}
