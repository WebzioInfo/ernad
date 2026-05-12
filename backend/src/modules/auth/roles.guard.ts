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

    const rawRoles = user.roles || (user.role ? [user.role] : []);
    const userRoles = rawRoles.map((r: any) => String(r).toUpperCase());
    const userPermissions = user.permissions || [];
    
    this.logger.debug(`[RolesGuard] Path: ${request.method} ${request.url} | User: ${user.username} | Roles: ${JSON.stringify(userRoles)} | Permissions: ${JSON.stringify(userPermissions)} | Required: ${JSON.stringify(requiredPermissions)}`);

    // SUPER_ADMIN bypasses all role/permission checks
    if (userRoles.includes('SUPER_ADMIN')) {
      return true;
    }

    // ── Role Check (Supports Prefix Matching e.g. OPERATOR_*) ──
    if (requiredRoles && requiredRoles.length > 0) {
      const rolePassed = requiredRoles.some(reqRole => 
        userRoles.some(userRole => 
          userRole === reqRole.toUpperCase() || userRole.startsWith(`${reqRole.toUpperCase()}_`)
        )
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
        if (userRoles.includes('MANAGER')) {
          const managerPermissions = ['analytics:view', 'reports:view', 'inventory:view', 'telemetry:log', 'production:start'];
          if (managerPermissions.includes(p)) {
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
