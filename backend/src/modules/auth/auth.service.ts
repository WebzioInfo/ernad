import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../../database/db';
import { users, operatorSessions, roles, permissions, rolePermissions, userRoles } from '../../database/schema';
import { eq, ilike, and, isNull, sql, or } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private jwtService: JwtService) {}

  async login(identity: string, credential: string, type?: 'PASSWORD' | 'PIN') {
    this.logger.log(`[AUTH_TRACE] Login process initiated for: ${identity}`);
    
    try {
      const trimmedIdentity = identity.trim();
      this.logger.debug(`[AUTH_TRACE] 1. Searching for user in database...`);
      
      const userResult = await db.select().from(users).where(
        or(
          ilike(users.username, trimmedIdentity),
          ilike(users.email, trimmedIdentity)
        )
      );
      
      this.logger.debug(`[AUTH_TRACE] 2. User lookup found ${userResult.length} matches`);
      const user = userResult[0];

      if (!user) {
        this.logger.warn(`[AUTH_TRACE] Login aborted: Identity not found [${trimmedIdentity}]`);
        throw new UnauthorizedException('Identity signature not recognized.');
      }

      this.logger.debug(`[AUTH_TRACE] 3. Starting credential verification (bcrypt)...`);
      let isMatch = false;

      try {
        if (type) {
          if (type === 'PASSWORD') {
            if (!user.passwordHash) throw new UnauthorizedException('Password access not configured.');
            isMatch = await bcrypt.compare(credential, user.passwordHash);
          } else {
            if (!user.pinCode) throw new UnauthorizedException('PIN access not configured.');
            isMatch = await bcrypt.compare(credential, user.pinCode);
          }
        } else {
          if (user.passwordHash) {
            isMatch = await bcrypt.compare(credential, user.passwordHash);
          }
          if (!isMatch && user.pinCode) {
            isMatch = await bcrypt.compare(credential, user.pinCode);
          }
        }
      } catch (bcryptErr: any) {
        this.logger.error(`[AUTH_TRACE] CRITICAL: Bcrypt module failure: ${bcryptErr.message}`);
        throw new UnauthorizedException('Security validation failure.');
      }

      this.logger.debug(`[AUTH_TRACE] 4. Credential verification result: ${isMatch}`);

      if (!isMatch) {
        this.logger.warn(`[AUTH_TRACE] Login aborted: Invalid credentials for ${user.username}`);
        throw new UnauthorizedException('Access credential rejected.');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account deactivated.');
      }

      this.logger.debug(`[AUTH_TRACE] 5. Compiling RBAC roles and permissions...`);

      // ── RBAC Resolution ──
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

      this.logger.debug(`[AUTH_TRACE] 6. Generating JWT session token...`);

      const payload = {
        sub: user.id,
        username: user.username,
        role: roleSlugs[0],
        roles: roleSlugs,
        permissions: permissionsSlugs,
        name: user.name,
        factoryId: user.factoryId,
      };

      const token = await this.jwtService.signAsync(payload);
      this.logger.log(`[AUTH_TRACE] 7. Login successful for ${user.username}.`);

      return {
        access_token: token,
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
    } catch (err: any) {
      this.logger.error(`[AUTH_CRITICAL_ERROR] Login process terminated abnormally: ${err.message}`, err.stack);
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(`Login failed: ${err.message || 'System error'}`);
    }
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

  async verifyTerminalPin(userId: string, pin: string) {
    const [user] = await db.select({ 
      pinCode: users.pinCode, 
      name: users.name, 
      isActive: users.isActive 
    }).from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) {
      throw new NotFoundException('Operator not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Operator account is inactive');
    }

    if (!user.pinCode) {
      throw new UnauthorizedException('Operator does not have a PIN configured');
    }

    const isMatch = await bcrypt.compare(pin, user.pinCode).catch(() => false);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid PIN');
    }

    return { success: true, operatorName: user.name };
  }
}
