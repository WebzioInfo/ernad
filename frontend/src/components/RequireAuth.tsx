
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

interface RequireAuthProps {
  children: JSX.Element;
  allowedRoles?: string[];
}

export default function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // SUPER_ADMIN bypasses all restrictions
  if (user?.role === 'SUPER_ADMIN') return children;

  // Very basic role enforcement logic
  if (allowedRoles && user && (!user.role || !allowedRoles.includes(user.role))) {
    // Standard operator shouldn't access Admin
    if (user.role?.includes('OPERATOR') && location.pathname !== '/line/1/operator') {
       return <Navigate to="/line/1/operator" replace />;
    }
    // Standard admin shouldn't access single operator view unless troubleshooting
    if (!user.role?.includes('OPERATOR') && location.pathname !== '/admin') {
       return <Navigate to="/admin" replace />; 
    }
  }


  return children;
}
