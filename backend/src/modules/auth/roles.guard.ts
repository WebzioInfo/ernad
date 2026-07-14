import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { Logger } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger('RolesGuard');
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();

    // STRICT BYPASS for preflight requests
    if (request.method === 'OPTIONS') {
      return true;
    }

    const { user } = request;

    if (!user) {
      this.logger.warn(`[RolesGuard] No user found in request for path: ${request.url}`);
      return false;
    }

    const rawRoles = user.role ? [user.role] : (user.roles || []);
    const normalizedRoles = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
    const userRoles = normalizedRoles.map((r: any) => {
      const roleStr = String(r).toUpperCase().trim();
      if (roleStr.includes('ADMIN')) return 'ADMIN';
      if (roleStr.includes('MANAGER')) return 'MANAGER';
      if (roleStr.includes('ACCOUNTANT')) return 'ACCOUNTANT';
      if (roleStr.includes('OPERATOR') || roleStr.includes('USER')) return 'OPERATOR';
      return 'OPERATOR'; // Fallback
    });
    const userPermissions = Array.isArray(user.permissions) ? user.permissions : [];

    this.logger.debug(`[RolesGuard] Path: ${request.method} ${request.url} | User: ${user.username} | Roles: ${JSON.stringify(userRoles)} | Permissions: ${JSON.stringify(userPermissions)} | Required: ${JSON.stringify(requiredPermissions)}`);

    // ── Role Check (Strict Exact Match) ──
    if (requiredRoles && requiredRoles.length > 0) {
      const rolePassed = requiredRoles.some(reqRole =>
        userRoles.includes(reqRole.toUpperCase() as 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'OPERATOR')
      );
      if (!rolePassed) {
        this.logger.warn(`[RolesGuard] Role Check Failed: User ${user.username} lacks required roles ${JSON.stringify(requiredRoles)}`);
        throw new ForbiddenException('Your industrial role does not permit access to this resource');
      }
    }

    // ── Permission Check ──
    if (requiredPermissions && requiredPermissions.length > 0) {
      // Helper to evaluate a single permission against role implicit lists and explicit user permissions
      const managerPermissions = [
        'analytics:view',
        'reports:view',
        'inventory:view',
        'inventory:edit',
        'telemetry:log',
        'production:start',
        'production:close',
        'forensics:view',
        'forensics:edit',
        'attendance:view',
        'settings:view',
        'settings:manage',
        'users:view',
        'notifications:view',
        'incidents:view',
        'incidents:create',
        'incidents:update',
        'users:manage',
        'sales:view',
        'sales:manage'
      ];

      const accountantPermissions = [
        'inventory:view',
        'inventory:edit',
        'inventory:update',
        'users:view',
        'sales:view',
        'sales:manage',
        'settings:view',
        'settings:manage',
        'notifications:view'
      ];

      const operatorPermissions = [
        'telemetry:log',
        'production:start',
        'production:close',
        'settings:view',
        'incidents:view',
        'incidents:create',
        'incidents:update'
      ];

      const checkPermission = (p: string): boolean => {
        if (userRoles.includes('ADMIN')) return true;
        if (userRoles.includes('MANAGER') && managerPermissions.includes(p)) return true;
        if (userRoles.includes('ACCOUNTANT') && accountantPermissions.includes(p)) return true;
        if (userRoles.includes('OPERATOR') && operatorPermissions.includes(p)) return true;
        return (userPermissions || []).includes(p);
      };

      const missing: string[] = [];
      for (const p of requiredPermissions) {
        if (!checkPermission(p)) missing.push(p);
      }

      if (missing.length > 0) {
        this.logger.warn(`[RolesGuard] Permission Check Failed: User ${user.username} lacks required permissions ${JSON.stringify(requiredPermissions)} | Missing: ${JSON.stringify(missing)} | UserRoles: ${JSON.stringify(userRoles)} | UserPermissions: ${JSON.stringify(userPermissions)} | Path: ${request.method} ${request.url}`);
        throw new ForbiddenException('You do not have the specific privileges required for this operation');
      }
    }

    return true;
  }
}
