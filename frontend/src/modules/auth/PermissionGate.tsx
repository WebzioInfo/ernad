import React from 'react';
import useAuthStore from './auth.store';

interface PermissionGateProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  permissions?: string[];
  fallback?: React.ReactNode;
}

export default function PermissionGate({ 
  children, 
  allowedRoles,
  permissions,
  fallback = null 
}: PermissionGateProps) {
  const user = useAuthStore((state: any) => state.user);

  if (!user) return <>{fallback}</>;
  
  // Super Admin God Mode bypass
  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.roles?.includes('SUPER_ADMIN');
  if (isSuperAdmin) return <>{children}</>;

  // Check Permissions (Primary)
  if (permissions && permissions.length > 0) {
    const hasPermission = permissions.some(p => user.permissions?.includes(p));
    if (hasPermission) return <>{children}</>;
  }

  // Check Roles (Legacy/Fallback)
  if (allowedRoles && allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
