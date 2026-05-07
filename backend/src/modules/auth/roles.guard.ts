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

    const userRoles = (user.roles || []).map((r: any) => String(r).toUpperCase());
    const userPermissions = user.permissions || [];
    
    this.logger.debug(`[RolesGuard] Path: ${request.url} | User: ${user.username} | Roles: ${JSON.stringify(userRoles)} | Permissions: ${JSON.stringify(userPermissions)}`);

    // SUPER_ADMIN bypasses all role/permission checks
    if (userRoles.includes('SUPER_ADMIN')) {
      return true;
    }

    // ── Role Check ──
    let rolePassed = true;
    if (requiredRoles && requiredRoles.length > 0) {
      rolePassed = requiredRoles.some(r => userRoles.includes(r.toUpperCase()));
    }

    // ── Permission Check ──
    let permissionPassed = true;
    if (requiredPermissions && requiredPermissions.length > 0) {
      permissionPassed = requiredPermissions.every(p => userPermissions.includes(p));
    }

    if (!rolePassed || !permissionPassed) {
      this.logger.warn(`[RolesGuard] Access Denied: rolePassed=${rolePassed}, permPassed=${permissionPassed} for user ${user.username}`);
      throw new ForbiddenException('You do not have sufficient privileges');
    }

    return true;
  }
}
