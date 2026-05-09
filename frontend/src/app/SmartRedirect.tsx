import { Navigate } from 'react-router-dom';
import useAuthStore from '../modules/auth/auth.store';

export default function SmartRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Determine home based on role
  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const isOperator = userRoles.some(r => r.includes('OPERATOR'));
  const isManager = userRoles.includes('MANAGER');
  
  if (isManager) {
    return <Navigate to="/manager/overview" replace />;
  }

  if (isOperator) {
    return <Navigate to="/line/select" replace />;
  }

  // Default for Admin/SuperAdmin
  return <Navigate to="/admin/overview" replace />;
}
