
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './auth.store';

interface RequireAuthProps {
  children: JSX.Element;
  allowedRoles?: string[];
  requiredPermissions?: string[];
}

export default function RequireAuth({ children, allowedRoles, requiredPermissions }: RequireAuthProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const rawRoles = user.roles || (user.role ? [user.role] : []);
  const canonicalRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATOR'];
  const hasInvalidRole = rawRoles.length === 0 || rawRoles.some((r: string) => !canonicalRoles.includes(r.toUpperCase().trim()));

  if (hasInvalidRole) {
    // Clear stale auth state immediately
    useAuthStore.getState().logout();
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRoles = rawRoles.map((r: string) => r.toUpperCase().trim());

  // ── Role Check ──
  let rolePassed = true;
  if (allowedRoles && allowedRoles.length > 0) {
    rolePassed = allowedRoles.some((r: string) => userRoles.includes(r));
  }

  // ── Permission Check ──
  let permissionPassed = true;
  if (requiredPermissions && requiredPermissions.length > 0) {
    permissionPassed = requiredPermissions.every(p => user?.permissions?.includes(p));
  }

  if (!rolePassed || !permissionPassed) {
    const isManager = userRoles.includes('MANAGER');
    const isOperator = userRoles.includes('OPERATOR');
    
    if (isManager) return <Navigate to="/manager/overview" replace />;
    if (isOperator) return <Navigate to="/operator/select" replace />;
    
    return <Navigate to="/admin/overview" replace />;
  }

  return children;
}
