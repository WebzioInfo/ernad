import { Navigate } from 'react-router-dom';
import useAuthStore from '../modules/auth/auth.store';

export default function SmartRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Determine home based on role
  const rawRoles = user.roles || (user.role ? [user.role] : []);
  const canonicalRoles = ['ADMIN', 'MANAGER', 'OPERATOR'];
  const hasInvalidRole = rawRoles.length === 0 || rawRoles.some((r: string) => !canonicalRoles.includes(r.toUpperCase().trim()));

  if (hasInvalidRole) {
    useAuthStore.getState().logout();
    return <Navigate to="/login" replace />;
  }

  const userRoles = rawRoles.map((r: string) => r.toUpperCase().trim());
  const isOperator = userRoles.includes('OPERATOR');
  const isManager = userRoles.includes('MANAGER');
  
  if (isManager) {
    return <Navigate to="/manager/overview" replace />;
  }

  if (isOperator) {
    return <Navigate to="/operator/select" replace />;
  }

  // Default for Admin
  return <Navigate to="/admin/overview" replace />;
}
