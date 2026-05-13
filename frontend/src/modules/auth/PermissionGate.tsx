import React from 'react';
import useAuthStore from './auth.store';
import { hasPermission, hasRole, isSuperAdmin, type PermissionSlug } from '../../lib/permissions';

interface PermissionGateProps {
  children: React.ReactNode;
  /** Role slugs (prefix-matched – OPERATOR matches OPERATOR_BLOWING etc.) */
  allowedRoles?: string[];
  /** Permission slugs e.g. 'production:start' */
  permissions?: PermissionSlug[];
  /** Require ALL permissions (default: any) */
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export default function PermissionGate({
  children,
  allowedRoles,
  permissions,
  requireAll = false,
  fallback = null,
}: PermissionGateProps) {
  const user = useAuthStore((state) => state.user);

  if (!user) return <>{fallback}</>;

  // SUPER_ADMIN bypasses everything (mirrors roles.guard.ts line 53)
  if (isSuperAdmin(user)) return <>{children}</>;

  // Permission check
  if (permissions && permissions.length > 0) {
    const check = requireAll
      ? permissions.every(p => hasPermission(user, p))
      : permissions.some(p => hasPermission(user, p));
    if (check) return <>{children}</>;
    // If permissions were specified and failed, don't fall through to role check
    if (!allowedRoles || allowedRoles.length === 0) return <>{fallback}</>;
  }

  // Role check (prefix-matching, mirrors guard line 59-67)
  if (allowedRoles && allowedRoles.length > 0) {
    if (hasRole(user, ...allowedRoles)) return <>{children}</>;
  }

  return <>{fallback}</>;
}
