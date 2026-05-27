import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { Logger } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger('RolesGuard');
  constructor(private reflector: Reflector) {}

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
    const userRoles = rawRoles.map((r: any) => {
      const roleStr = String(r).toUpperCase().trim();
      if (roleStr.includes('ADMIN')) return 'ADMIN';
      if (roleStr.includes('MANAGER')) return 'MANAGER';
      if (roleStr.includes('OPERATOR') || roleStr.includes('USER')) return 'OPERATOR';
      return 'OPERATOR'; // Fallback
    });
    const userPermissions = user.permissions || [];
    
    this.logger.debug(`[RolesGuard] Path: ${request.method} ${request.url} | User: ${user.username} | Roles: ${JSON.stringify(userRoles)} | Permissions: ${JSON.stringify(userPermissions)} | Required: ${JSON.stringify(requiredPermissions)}`);

    // ── Role Check (Strict Exact Match) ──
    if (requiredRoles && requiredRoles.length > 0) {
      const rolePassed = requiredRoles.some(reqRole => 
        userRoles.includes(reqRole.toUpperCase())
      );
      if (!rolePassed) {
        this.logger.warn(`[RolesGuard] Role Check Failed: User ${user.username} lacks required roles ${JSON.stringify(requiredRoles)}`);
        throw new ForbiddenException('Your industrial role does not permit access to this resource');
      }
    }

    // ── Permission Check ──
    if (requiredPermissions && requiredPermissions.length > 0) {
      const permissionPassed = requiredPermissions.every(p => {
        // [HARDENED] Manager Role implicit permissions for oversight
        if (userRoles.includes('ADMIN')) {
          return true;
        }

        if (userRoles.includes('MANAGER')) {
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
            'settings:view'
          ];
          if (managerPermissions.includes(p)) {
            return true;
          }
        }

        // [HARDENED] Operator Role implicit permissions for operations
        if (userRoles.includes('OPERATOR')) {
          const operatorPermissions = [
            'telemetry:log',
            'production:start',
            'production:close',
            'settings:view'
          ];
          if (operatorPermissions.includes(p)) {
            return true;
          }
        }
        
        return userPermissions.includes(p);
      });

      if (!permissionPassed) {
        this.logger.warn(`[RolesGuard] Permission Check Failed: User ${user.username} lacks required permissions ${JSON.stringify(requiredPermissions)}`);
        throw new ForbiddenException('You do not have the specific privileges required for this operation');
      }
    }

    return true;
  }
}
