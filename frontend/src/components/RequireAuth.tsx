
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

interface RequireAuthProps {
  children: JSX.Element;
  allowedRoles?: string[];
  requiredPermissions?: string[];
}

export default function RequireAuth({ children, allowedRoles, requiredPermissions }: RequireAuthProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  
  // SUPER_ADMIN bypass
  if (userRoles.includes('SUPER_ADMIN')) {
    return children;
  }

  // ── Role Check ──
  let rolePassed = true;
  if (allowedRoles && allowedRoles.length > 0) {
    rolePassed = allowedRoles.some(r => userRoles.includes(r));
  }

  // ── Permission Check ──
  let permissionPassed = true;
  if (requiredPermissions && requiredPermissions.length > 0) {
    permissionPassed = requiredPermissions.every(p => user?.permissions?.includes(p));
  }

  if (!rolePassed || !permissionPassed) {
    const isOperator = userRoles.some(r => r.includes('OPERATOR'));
    const isManager = userRoles.includes('MANAGER');
    
    if (isOperator) return <Navigate to="/line/select" replace />;
    if (isManager) return <Navigate to="/manager/overview" replace />;
    
    return <Navigate to="/admin/overview" replace />;
  }

  return children;
}
