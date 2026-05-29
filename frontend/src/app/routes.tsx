import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../modules/auth/Login';
import RequireAuth from '../modules/auth/RequireAuth';
import SmartRedirect from './SmartRedirect';
// TEMP DISABLED - Future Admin Feature
// import ComingSoonPage from '../components/common/ComingSoonPage';
// import { Sparkle, Sparkles, Bell, Database, Command, Users } from 'lucide-react';
import { LoadingScreen } from '../components/common/LoadingScreen';

// Optimized Module Loading
const OperatorPanel = lazy(() => import('../modules/production/OperatorPanel'));
const LineSelectionPage = lazy(() => import('../modules/production/LineSelectionPage'));
const StationSelectionPage = lazy(() => import('../modules/production/StationSelectionPage'));
const TerminalDashboard = lazy(() => import('../modules/production/TerminalDashboard'));
const IncidentsDashboard = lazy(() => import('../modules/incidents/pages/IncidentsDashboard'));



import { moduleRegistry } from './registry/moduleRegistry';
import { RouteDefinition } from './registry/types';

export function AppRoutes() {
  const renderRoutes = (routes: RouteDefinition[]) => {
    return routes.map((route, idx) => (
      <Route 
        key={idx}
        path={route.path} 
        element={
          <RequireAuth 
            allowedRoles={route.allowedRoles} 
            requiredPermissions={route.requiredPermissions}
          >
            <route.element />
          </RequireAuth>
        }
      >
        {route.children && renderRoutes(route.children)}
      </Route>
    ));
  };

  const dynamicRoutes = moduleRegistry.getAllRoutes();

  return (
    <Suspense fallback={<LoadingScreen message="Initializing System Module..." />}>
      <Routes>
        {/* Public & Core */}
        <Route path="/" element={<SmartRedirect />} />
        <Route path="/login" element={<Login />} />

        {/* 1. ADMINISTRATION (Admin) */}
        <Route
          path="/admin"
          element={
            <RequireAuth allowedRoles={['ADMIN']}>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/admin/overview" replace />} />
          {renderRoutes(dynamicRoutes)}
          
          {/* Static / Compatibility Routes (Coming Soon) */}
          {/* 
          <Route path="ai-advices" element={<ComingSoonPage title="AI Integrated Advices" description="Our neural network is currently analyzing your production historical data to provide real-time optimization strategies." icon={Sparkle} />} />
          <Route path="quality" element={<ComingSoonPage title="Quality Management" description="QC testing modules and digital lab reports are in final validation phase." icon={Bell} />} />
          <Route path="tally" element={<ComingSoonPage title="Tally ERP Integration" description="Bi-directional synchronization with Tally ERP for automated accounting and voucher generation." icon={Database} />} />
          <Route path="billing" element={<ComingSoonPage title="Payments & Billing" description="Integrated payment gateway and customer invoicing system for streamlined financial operations." icon={Command} />} />
          <Route path="distributors" element={<ComingSoonPage title="Distributor Network" description="Centralized management portal for your global distribution network and supply chain partners." icon={Users} />} />
          */}
          
          {/* Redirects for disabled/commented-out routes */}
          <Route path="ai-advices" element={<Navigate to="/admin/overview" replace />} />
          <Route path="tally" element={<Navigate to="/admin/overview" replace />} />
          <Route path="billing" element={<Navigate to="/admin/overview" replace />} />
          <Route path="distributors" element={<Navigate to="/admin/overview" replace />} />
          <Route path="reports/attendance" element={<Navigate to="/admin/overview" replace />} />
        </Route>

        {/* 2. MANAGEMENT (Managers) */}
        <Route
          path="/manager"
          element={
            <RequireAuth allowedRoles={['MANAGER']}>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/manager/overview" replace />} />
          {renderRoutes(dynamicRoutes)}
          {/* Static / Compatibility Routes (Coming Soon) */}
          {/* 
          <Route path="quality" element={<ComingSoonPage title="Quality Management" description="QC testing modules and digital lab reports are in final validation phase." icon={Bell} />} />
          <Route path="ai-advices" element={<ComingSoonPage title="AI Integrated Advices" description="Our neural network is currently analyzing your production historical data to provide real-time optimization strategies." icon={Sparkles} />} />
          <Route path="tally" element={<ComingSoonPage title="Tally ERP Integration" description="Bi-directional synchronization with Tally ERP for automated accounting and voucher generation." icon={Database} />} />
          <Route path="billing" element={<ComingSoonPage title="Payments & Billing" description="Integrated payment gateway and customer invoicing system for streamlined financial operations." icon={Command} />} />
          <Route path="distributors" element={<ComingSoonPage title="Distributor Network" description="Centralized management portal for your global distribution network and supply chain partners." icon={Users} />} />
          */}

          {/* Redirects for disabled/commented-out routes */}
          <Route path="ai-advices" element={<Navigate to="/manager/overview" replace />} />
          <Route path="tally" element={<Navigate to="/manager/overview" replace />} />
          <Route path="billing" element={<Navigate to="/manager/overview" replace />} />
          <Route path="distributors" element={<Navigate to="/manager/overview" replace />} />
        </Route>

        {/* 3. OPERATOR PORTAL (Authenticated via Login) */}
        <Route
          path="/operator"
          element={
            <RequireAuth allowedRoles={['ADMIN', 'MANAGER', 'OPERATOR']}>
              <Outlet />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/operator/select" replace />} />
          <Route path="select" element={<LineSelectionPage />} />
          <Route path="select/:id" element={<StationSelectionPage />} />
          <Route path="workspace/:id/:station" element={<OperatorPanel />} />
          <Route path="incidents" element={<IncidentsDashboard />} />
        </Route>

        {/* 4. SHARED TERMINAL (Public/Kiosk Access) */}
        <Route
          path="/line"
          element={
            <RequireAuth allowedRoles={['ADMIN', 'MANAGER', 'OPERATOR']}>
              <Outlet />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/line/select" replace />} />
          <Route path="select" element={<LineSelectionPage />} />
          <Route path=":id/:station/operator" element={<OperatorPanel />} />
          <Route path=":id/operator" element={<OperatorPanel />} />
        </Route>

        {/* 5. INDUSTRIAL TERMINAL (Registered Tablets) */}
        <Route
          path="/terminal"
          element={
            <RequireAuth allowedRoles={['ADMIN', 'MANAGER', 'OPERATOR']}>
              <Outlet />
            </RequireAuth>
          }
        >
          <Route index element={<TerminalDashboard />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<SmartRedirect />} />
      </Routes>
    </Suspense>
  );
}
