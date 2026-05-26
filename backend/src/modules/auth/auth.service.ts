import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../../database/db';
import { users, operatorSessions, roles, permissions, rolePermissions, userRoles } from '../../database/schema';
import { eq, ilike, and, isNull, sql, or } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { OperatorSessionsService } from '../operator-sessions/operator-sessions.service';

const ROLE_PRECEDENCE = [
  'ADMIN',
  'MANAGER',
  'OPERATOR'
];

function normalizeRole(roleSlug: string): string {
  const r = (roleSlug || '').toUpperCase().trim();
  
  if (r === 'GENERIC OPERATOR') return 'OPERATOR';
  if (r === 'PRODUCTION MANAGER') return 'MANAGER';
  if (r.includes('ADMIN')) return 'ADMIN';
  if (r.includes('MANAGER')) return 'MANAGER';
  
  return 'OPERATOR'; // fallback
}

function sortRoles(roleSlugs: string[]): string[] {
  return [...roleSlugs].sort((a, b) => {
    let indexA = ROLE_PRECEDENCE.indexOf(a);
    let indexB = ROLE_PRECEDENCE.indexOf(b);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    return indexA - indexB;
  });
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private sessionService: OperatorSessionsService
  ) {}

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

      this.logger.debug(`[AUTH_TRACE] 3. Compiling RBAC roles and permissions...`);

      // ── RBAC Resolution ──
      const userRolesResult = await db.select({
        id: roles.id,
        slug: roles.slug,
        name: roles.name,
      })
      .from(roles)
      .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

      const roleSlugs = Array.from(new Set(userRolesResult.map(r => normalizeRole(r.slug))));
      const sortedRoles = sortRoles(roleSlugs);
      const effectiveRole = sortedRoles[0] || 'OPERATOR';
      const isManagerOrAdmin = ['ADMIN', 'MANAGER'].includes(effectiveRole);

      this.logger.debug(`[AUTH_TRACE] 4. Starting credential verification (bcrypt) for role: ${effectiveRole}...`);
      let isMatch = false;

      try {
        if (isManagerOrAdmin) {
          // Managers/admins MUST authenticate via password
          if (!user.passwordHash) {
            throw new UnauthorizedException('Password access credentials not configured.');
          }
          isMatch = await bcrypt.compare(credential, user.passwordHash).catch(() => false);
        } else {
          // Operators authenticate via PIN
          if (!user.pinCode) {
            throw new UnauthorizedException('PIN access credentials not configured.');
          }
          isMatch = await bcrypt.compare(credential, user.pinCode).catch(() => false);
        }
      } catch (bcryptErr: any) {
        if (bcryptErr instanceof UnauthorizedException) {
          throw bcryptErr;
        }
        this.logger.error(`[AUTH_TRACE] CRITICAL: Bcrypt module failure: ${bcryptErr.message}`);
        throw new UnauthorizedException('Security validation failure.');
      }

      this.logger.debug(`[AUTH_TRACE] 5. Credential verification result: ${isMatch}`);

      if (!isMatch) {
        this.logger.warn(`[AUTH_TRACE] Login aborted: Invalid credentials for ${user.username}`);
        throw new UnauthorizedException('Access credential rejected.');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account deactivated.');
      }

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
        id: user.id,
        username: user.username,
        role: effectiveRole,
        roles: sortedRoles,
        permissions: permissionsSlugs,
        name: user.name,
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
          role: effectiveRole,
          roles: sortedRoles,
          permissions: permissionsSlugs,
          jobTitle: user.jobTitle,
          department: user.department,
          avatarUrl: user.avatarUrl,
        },
      };
    } catch (err: any) {
      this.logger.error(`[AUTH_CRITICAL_ERROR] Login process terminated abnormally: ${err.message}`, err.stack);
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(`Login failed: ${err.message || 'System error'}`);
    }
  }

  async startOperatorSession(userId: string, lineId: string, shiftId: string) {
    return this.sessionService.startSession(userId, lineId, 'GENERAL', shiftId, true);
  }


  async logoutOperatorSession(userId: string) {
    await db.update(operatorSessions)
      .set({ endTime: new Date(), isActive: false, endReason: 'manual' })
      .where(and(eq(operatorSessions.userId, userId), eq(operatorSessions.isActive, true)));
    
    return { success: true };
  }

  async resetCredentialById(adminRoles: string[], userId: string, newCredential: string, type: 'PASSWORD' | 'PIN') {
    const isAdmin = adminRoles.includes('ADMIN');
    const isManager = adminRoles.includes('MANAGER');

    const targetUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!targetUser[0]) throw new NotFoundException('User not found');

    // Hierarchy Check
    const targetRolesResult = await db.select({ slug: roles.slug })
      .from(roles)
      .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    const targetRoles = targetRolesResult.map(r => r.slug);

    if (isManager) {
      const isPrivileged = targetRoles.some(r => r === 'ADMIN');
      if (isPrivileged) throw new ForbiddenException('Managers cannot reset administrative credentials');
    }

    if (!isAdmin && !isManager) {
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

  async terminalLogin(operatorId: string, pin: string, lineId: string, station: string, terminalId?: string) {
    this.logger.log(`[TERMINAL_AUTH] Login attempt for Operator: ${operatorId} at Station: ${station} (Terminal: ${terminalId})`);

    // 1. UUID Validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validate = (id: string | undefined, name: string) => {
      if (!id) throw new BadRequestException(`${name} is required.`);
      if (!uuidRegex.test(id)) {
        throw new BadRequestException(`Invalid ${name} format. Must be a valid UUID.`);
      }
    };

    validate(operatorId, 'operatorId');
    validate(lineId, 'lineId');
    if (terminalId) validate(terminalId, 'terminalId');

    // 2. Verify PIN and Get User
    const [user] = await db.select().from(users).where(eq(users.id, operatorId)).limit(1);
    
    if (!user) {
      this.logger.warn(`[TERMINAL_AUTH] Login failed: Operator ${operatorId} not found.`);
      throw new NotFoundException('Operator profile not found.');
    }

    if (!user.isActive) {
      this.logger.warn(`[TERMINAL_AUTH] Login failed: Operator ${user.username} is inactive.`);
      throw new UnauthorizedException('Operator account is deactivated.');
    }

    const isMatch = await bcrypt.compare(pin, user.pinCode).catch(() => false);
    if (!isMatch) {
      this.logger.warn(`[TERMINAL_AUTH] Login failed: Invalid PIN for ${user.username}`);
      throw new UnauthorizedException('Invalid security PIN.');
    }

    // 5. RBAC Enforcement: Strict Exact-Match Operator Check
    const userRolesResult = await db.select({
      id: roles.id,
      slug: roles.slug,
    })
    .from(roles)
    .innerJoin(userRoles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

    const roleSlugs = Array.from(new Set(userRolesResult.map(r => normalizeRole(r.slug))));
    
    // Explicit list of authorized operator roles (No substring matching)
    const allowedOperatorRoles = [
      'OPERATOR', 
      'ADMIN',        // Keep emergency override
      'MANAGER'       // Allow managers to access terminal
    ];

    const isOperator = roleSlugs.some(r => allowedOperatorRoles.includes(r));
    
    if (!isOperator) {
      this.logger.error(`[RBAC_VIOLATION] Unauthorized terminal access attempt by role: ${roleSlugs.join(', ')}`);
      throw new ForbiddenException('Your role does not permit operator terminal access.');
    }

    const sortedRoles = sortRoles(roleSlugs);
    const operatorRoles = sortedRoles.filter(r => r === 'OPERATOR');
    const effectiveRole = operatorRoles[0] || sortedRoles[0] || 'OPERATOR';

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

    // 6. Start Session
    try {
      const session = await this.sessionService.startSession(operatorId, lineId, station, undefined, true, terminalId);

      // 7. Generate Token with Dynamic Roles
      const payload = {
        sub: user.id,
        id: user.id,
        username: user.username,
        role: effectiveRole,
        roles: sortedRoles,
        permissions: permissionsSlugs,
        name: user.name,
        sessionId: session.id,
        deviceId: undefined
      };

      const token = await this.jwtService.signAsync(payload);
      this.logger.log(`[TERMINAL_AUTH] Session granted: ${session.id} for operator ${user.username}`);

      return {
        success: true,
        access_token: token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: effectiveRole,
          roles: sortedRoles,
          permissions: permissionsSlugs,
          sessionId: session.id,
        },
        operator: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: 'OPERATOR',
        },
        session
      };
    } catch (err: any) {
      this.logger.error(`[TERMINAL_AUTH_ERR] Session creation failed: ${err.message}`);
      throw err;
    }
  }
}

