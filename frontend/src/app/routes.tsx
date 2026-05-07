import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../modules/auth/Login';
import RequireAuth from '../modules/auth/RequireAuth';
import SmartRedirect from './SmartRedirect';
import ComingSoonPage from '../components/common/ComingSoonPage';
import { Sparkle, Sparkles } from 'lucide-react';
import { LoadingScreen } from '../components/common/LoadingScreen';

// Optimized Module Loading
const ExecutiveDashboard = lazy(() => import('../modules/analytics/ExecutiveDashboard'));
const EfficiencyDashboardPage = lazy(() => import('../modules/analytics/EfficiencyDashboardPage'));
const ProductionControlPage = lazy(() => import('../modules/production/ProductionControlPage'));
const UserManagementPage = lazy(() => import('../modules/personnel/UserManagementPage'));
const StaffDirectoryPage = lazy(() => import('../modules/personnel/StaffDirectoryPage'));
const AuditLogsPage = lazy(() => import('../modules/personnel/AuditLogsPage'));
const InventoryPage = lazy(() => import('../modules/inventory/InventoryPage'));
const AttendanceRecordsPage = lazy(() => import('../modules/attendance/AttendanceRecordsPage'));
const QualityManagementPage = lazy(() => import('../modules/production/QualityManagementPage'));
const OperatorPanel = lazy(() => import('../modules/production/OperatorPanel'));
const LineSelectionPage = lazy(() => import('../modules/production/LineSelectionPage'));
const SettingsPage = lazy(() => import('../modules/settings/SettingsPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen message="Initializing System Module..." />}>
      <Routes>
        {/* Public & Core */}
        <Route path="/" element={<SmartRedirect />} />
        <Route path="/login" element={<Login />} />

        {/* 1. ADMINISTRATION (SuperAdmin & Admin) */}
        <Route
          path="/admin"
          element={
            <RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path="overview" element={<ExecutiveDashboard />} />
          <Route path="analytics" element={<EfficiencyDashboardPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="audit" element={<AuditLogsPage />} />
          <Route path="staffs" element={<StaffDirectoryPage />} />
          <Route path="attendance" element={<AttendanceRecordsPage />} />
          <Route path="ai-advices" element={<ComingSoonPage title="AI Integrated Advices" description="Our neural network is currently analyzing your production historical data to provide real-time optimization strategies." icon={Sparkle} />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="production" element={<ProductionControlPage />} />
          <Route path="quality" element={<QualityManagementPage />} />
          <Route path="inventory" element={<InventoryPage />} />
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
          <Route path="overview" element={<ExecutiveDashboard />} />
          <Route path="production" element={<ProductionControlPage />} />
          <Route path="quality" element={<QualityManagementPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="staffs" element={<StaffDirectoryPage />} />
          <Route path="ai-advices" element={<ComingSoonPage title="AI Integrated Advices" description="Our neural network is currently analyzing your production historical data to provide real-time optimization strategies." icon={Sparkles} />} />
        </Route>

        {/* 3. OPERATOR (All Operator Roles) */}
        <Route
          path="/line"
          element={
            <RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'OPERATOR_BLOWING', 'OPERATOR_FILLING', 'OPERATOR_LABELING', 'OPERATOR_PACKING']}>
              <Outlet />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/line/select" replace />} />
          <Route path="select" element={<LineSelectionPage />} />
          <Route path=":id/operator" element={<OperatorPanel />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<SmartRedirect />} />
      </Routes>
    </Suspense>
  );
}
