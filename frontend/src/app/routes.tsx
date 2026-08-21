import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../modules/auth/Login';
import ForgotPassword from '../modules/auth/ForgotPassword';
import ResetPassword from '../modules/auth/ResetPassword';
import RequireAuth from '../modules/auth/RequireAuth';
import SmartRedirect from './SmartRedirect';
// TEMP DISABLED - Future Admin Feature
// import ComingSoonPage from '../components/common/ComingSoonPage';
// import { Sparkle, Sparkles, Bell, Database, Command, Users } from 'lucide-react';
import { LoadingScreen } from '../components/common/LoadingScreen';

const SalesAnalyticsPage = lazy(() => import('../modules/reports/pages/SalesAnalyticsPage'));
const ProductsPage = lazy(() => import('../modules/inventory/ProductsPage'));
const RawMaterialsPage = lazy(() => import('../modules/inventory/RawMaterialsPage'));

// Optimized Module Loading
const OperatorPanel = lazy(() => import('../modules/production/OperatorPanel'));
const LineSelectionPage = lazy(() => import('../modules/production/LineSelectionPage'));
const StationSelectionPage = lazy(() => import('../modules/production/StationSelectionPage'));
const TerminalDashboard = lazy(() => import('../modules/production/TerminalDashboard'));
const IncidentsDashboard = lazy(() => import('../modules/incidents/pages/IncidentsDashboard'));
const DiagnosticsPage = lazy(() => import('./DiagnosticsPage'));
const KenbyAIPage = lazy(() => import('../modules/ai/KenbyAIPage'));

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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/sales"
          element={
            <RequireAuth allowedRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<SalesAnalyticsPage />} />
        </Route>

        {/* 0. OWNER ASSISTANT */}
        <Route
          path="/owner"
          element={
            <RequireAuth allowedRoles={['ADMIN']}>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/owner/ai" replace />} />
          <Route path="ai" element={<KenbyAIPage />} />
        </Route>

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
          <Route path="ai" element={<KenbyAIPage />} />
          <Route path="sales" element={
            <RequireAuth allowedRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}>
              <SalesAnalyticsPage />
            </RequireAuth>
          } />
          <Route path="products" element={<ProductsPage />} />
          <Route path="raw-materials" element={<RawMaterialsPage />} />
          <Route path="inventory/raw-materials" element={<Navigate to="/admin/raw-materials" replace />} />
          <Route path="inventory/products" element={<Navigate to="/admin/products" replace />} />
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
          <Route path="sales" element={
            <RequireAuth allowedRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}>
              <SalesAnalyticsPage />
            </RequireAuth>
          } />
          <Route path="products" element={<ProductsPage />} />
          <Route path="raw-materials" element={<RawMaterialsPage />} />
          <Route path="inventory/raw-materials" element={<Navigate to="/manager/raw-materials" replace />} />
          <Route path="inventory/products" element={<Navigate to="/manager/products" replace />} />
          {renderRoutes(dynamicRoutes)}
        </Route>

        {/* 3. ACCOUNTANT PORTAL */}
        <Route
          path="/accountant"
          element={
            <RequireAuth allowedRoles={['ACCOUNTANT']}>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="sales" element={
            <RequireAuth allowedRoles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}>
              <SalesAnalyticsPage />
            </RequireAuth>
          } />
          <Route path="products" element={<ProductsPage />} />
          <Route path="raw-materials" element={<RawMaterialsPage />} />
          <Route path="inventory/raw-materials" element={<Navigate to="/accountant/raw-materials" replace />} />
          <Route path="inventory/products" element={<Navigate to="/accountant/products" replace />} />
          {renderRoutes(dynamicRoutes)}
        </Route>

        {/* 4. OPERATOR PORTAL (Authenticated via Login) */}
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

        {/* Diagnostics & Public Tools */}
        <Route path="/debug" element={<DiagnosticsPage />} />

        {/* Catch-all */}
        <Route path="*" element={<SmartRedirect />} />
      </Routes>
    </Suspense>
  );
}
