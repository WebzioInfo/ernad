/**
 * ERNAD MES permission helpers.
 * Source of truth: backend/src/modules/auth/roles.guard.ts
 */

export const PERMISSIONS = {
  PRODUCTION_START: 'production:start',
  PRODUCTION_CLOSE: 'production:close',
  ANALYTICS_VIEW: 'analytics:view',
  REPORTS_VIEW: 'reports:view',
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_EDIT: 'inventory:edit',
  TELEMETRY_LOG: 'telemetry:log',
  FORENSICS_VIEW: 'forensics:view',
  FORENSICS_EDIT: 'forensics:edit',
  ATTENDANCE_VIEW: 'attendance:view',
  USER_VIEW: 'user:view',
  USER_EDIT: 'user:edit',
} as const;

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATOR: 'OPERATOR',
} as const;

export type RoleSlug = (typeof ROLES)[keyof typeof ROLES];

const MANAGER_IMPLICIT_PERMISSIONS: PermissionSlug[] = [
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_EDIT,
  PERMISSIONS.TELEMETRY_LOG,
  PERMISSIONS.PRODUCTION_START,
  PERMISSIONS.PRODUCTION_CLOSE,
  PERMISSIONS.FORENSICS_VIEW,
  PERMISSIONS.FORENSICS_EDIT,
  PERMISSIONS.ATTENDANCE_VIEW,
];

interface UserPermContext {
  role: string;
  roles: string[];
  permissions: string[];
}

export function isManager(user: UserPermContext): boolean {
  return user.roles.includes(ROLES.MANAGER) || user.role === ROLES.MANAGER;
}

export function isOperator(user: UserPermContext): boolean {
  const allRoles = [...(user.roles || []), user.role || ''];
  return allRoles.some(r => r === ROLES.OPERATOR);
}

export function hasPermission(user: UserPermContext, permission: PermissionSlug): boolean {
  if (isManager(user) && MANAGER_IMPLICIT_PERMISSIONS.includes(permission)) return true;
  return user.permissions.includes(permission);
}

export function hasAllPermissions(user: UserPermContext, permissions: PermissionSlug[]): boolean {
  return permissions.every(p => hasPermission(user, p));
}

export function hasAnyPermission(user: UserPermContext, permissions: PermissionSlug[]): boolean {
  return permissions.some(p => hasPermission(user, p));
}

export function hasRole(user: UserPermContext, ...roleSlugs: string[]): boolean {
  const userRoles = [...(user.roles || []), user.role || ''].map(r => String(r).toUpperCase());
  return roleSlugs.some(reqRole => userRoles.includes(reqRole.toUpperCase()));
}

export const ROUTE_ACCESS: Record<string, { roles?: string[]; permissions?: PermissionSlug[] }> = {
  '/production': { permissions: [PERMISSIONS.PRODUCTION_START] },
  '/management': { permissions: [PERMISSIONS.PRODUCTION_START] },
  '/forensics/:id': { permissions: [PERMISSIONS.FORENSICS_VIEW] },
  '/terminal': { roles: [ROLES.ADMIN] },
  '/quality': { permissions: [PERMISSIONS.PRODUCTION_START] },
  '/products': { permissions: [PERMISSIONS.INVENTORY_VIEW] },
  '/raw-materials': { permissions: [PERMISSIONS.INVENTORY_VIEW] },
  '/analytics': { permissions: [PERMISSIONS.ANALYTICS_VIEW] },
  '/reports': { permissions: [PERMISSIONS.REPORTS_VIEW] },
  '/attendance': { permissions: [PERMISSIONS.ATTENDANCE_VIEW] },
  '/personnel': { permissions: [PERMISSIONS.USER_VIEW] },
  '/settings': { roles: [ROLES.ADMIN] },
  '/operator/select': { roles: [ROLES.OPERATOR, ROLES.MANAGER, ROLES.ADMIN] },
};
