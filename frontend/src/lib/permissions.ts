/**
 * ERNAD MES – PERMISSION SYSTEM
 * Source of truth: backend/src/modules/auth/roles.guard.ts
 *
 * Role slugs come from the `roles.slug` column.
 * Permission slugs come from the `permissions.slug` column.
 *
 * MANAGER implicit permissions are hardcoded in roles.guard.ts – mirrored here.
 * SUPER_ADMIN bypasses everything (guard line 53).
 */

// ── Permission slugs (exact match to permissions.slug DB column) ─────────────

export const PERMISSIONS = {
  // Production
  PRODUCTION_START: 'production:start',
  PRODUCTION_CLOSE: 'production:close',
  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  // Reports
  REPORTS_VIEW: 'reports:view',
  // Inventory
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_EDIT: 'inventory:edit',
  // Telemetry
  TELEMETRY_LOG: 'telemetry:log',
  // Forensics
  FORENSICS_VIEW: 'forensics:view',
  FORENSICS_EDIT: 'forensics:edit',
  // Attendance
  ATTENDANCE_VIEW: 'attendance:view',
  // Users
  USER_VIEW: 'user:view',
  USER_EDIT: 'user:edit',
} as const;

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ── Role slugs (exact match to roles.slug DB column) ─────────────────────────

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATOR: 'OPERATOR',
} as const;

export type RoleSlug = string; // open because custom roles can exist

/**
 * Permissions implicitly granted to MANAGER role by the backend guard.
 * If the backend changes this list, update here too.
 */
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

// ── Core check functions ──────────────────────────────────────────────────────

interface UserPermContext {
  role: string;
  roles: string[];
  permissions: string[];
}

export function isSuperAdmin(user: UserPermContext): boolean {
  return user.roles.includes(ROLES.SUPER_ADMIN) || user.role === ROLES.SUPER_ADMIN;
}

export function isManager(user: UserPermContext): boolean {
  return user.roles.includes(ROLES.MANAGER) || user.role === ROLES.MANAGER;
}

export function isOperator(user: UserPermContext): boolean {
  const allRoles = [...(user.roles || []), user.role || ''];
  return allRoles.some(r => r.includes('OPERATOR'));
}

/**
 * Mirrors the exact logic in roles.guard.ts canActivate().
 */
export function hasPermission(user: UserPermContext, permission: PermissionSlug): boolean {
  if (isSuperAdmin(user)) return true;
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
  if (isSuperAdmin(user)) return true;
  const userRoles = [...(user.roles || []), user.role || ''];
  // Backend does prefix matching: OPERATOR matches OPERATOR_BLOWING
  return roleSlugs.some(reqRole =>
    userRoles.some(
      ur => ur.toUpperCase() === reqRole.toUpperCase() || ur.toUpperCase().startsWith(`${reqRole.toUpperCase()}_`)
    )
  );
}

// ── Route-level access matrix ─────────────────────────────────────────────────
// Maps each app route to what's required. Used by RequireAuth & sidebar.

export const ROUTE_ACCESS: Record<string, { roles?: string[]; permissions?: PermissionSlug[] }> = {
  '/production':       { permissions: [PERMISSIONS.PRODUCTION_START] },
  '/management':       { permissions: [PERMISSIONS.PRODUCTION_START] },
  '/forensics/:id':   { permissions: [PERMISSIONS.FORENSICS_VIEW] },
  '/terminal':         { roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
  '/quality':          { permissions: [PERMISSIONS.PRODUCTION_START] },
  '/inventory':        { permissions: [PERMISSIONS.INVENTORY_VIEW] },
  '/analytics':        { permissions: [PERMISSIONS.ANALYTICS_VIEW] },
  '/reports':          { permissions: [PERMISSIONS.REPORTS_VIEW] },
  '/attendance':       { permissions: [PERMISSIONS.ATTENDANCE_VIEW] },
  '/personnel':        { permissions: [PERMISSIONS.USER_VIEW] },
  '/settings':         { roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN] },
  '/operator/select':  { roles: [ROLES.OPERATOR, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN] },
};
