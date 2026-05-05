import React from 'react';
import useAuthStore from '../store/useAuthStore';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'OPERATOR_BLOWING' | 'OPERATOR_FILLING' | 'OPERATOR_LABELING' | 'OPERATOR_PACKING' | 'OPERATOR';

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
  const user = useAuthStore((state) => state.user);

  if (!user) return <>{fallback}</>;
  
  // Super Admin bypass
  if (user.role === 'SUPER_ADMIN') return <>{children}</>;

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
