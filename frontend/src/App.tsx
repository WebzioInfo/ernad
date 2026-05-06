import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import DashboardLayout from './layouts/DashboardLayout';

// Optimized Module Loading
const ExecutiveDashboard = lazy(() => import('./modules/analytics/ExecutiveDashboard'));
const EfficiencyDashboardPage = lazy(() => import('./modules/analytics/EfficiencyDashboardPage'));
const ProductionControlPage = lazy(() => import('./modules/production/ProductionControlPage'));
const UserManagementPage = lazy(() => import('./modules/personnel/UserManagementPage'));
const StaffDirectoryPage = lazy(() => import('./modules/personnel/StaffDirectoryPage'));
const AuditLogsPage = lazy(() => import('./modules/personnel/AuditLogsPage'));
const InventoryPage = lazy(() => import('./modules/inventory/InventoryPage'));
const AttendanceRecordsPage = lazy(() => import('./modules/attendance/AttendanceRecordsPage'));
const QualityManagementPage = lazy(() => import('./modules/production/QualityManagementPage'));
const OperatorPanel = lazy(() => import('./modules/production/OperatorPanel'));
const LineSelectionPage = lazy(() => import('./modules/production/LineSelectionPage'));
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage'));

import Login from './components/Login';
import RequireAuth from './components/RequireAuth';
import SmartRedirect from './components/SmartRedirect';
import ComingSoonPage from './components/common/ComingSoonPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePushNotifications } from './hooks/usePushNotifications';
import { Sparkle, Sparkles } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
      retry: 1,
    },
  },
});

function AppInner() {
  usePushNotifications();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppInner />
        <div className="min-h-screen bg-slate-50">
          <Toaster position="top-right" expand={true} richColors closeButton />

          <Suspense fallback={
            <div className="h-screen w-full flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold animate-pulse">Initializing System Module...</p>
              </div>
            </div>
          }>
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
                {/* Admin can also access operations */}
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
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
