import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AdminDashboard from './features/analytics/components/AdminDashboard';
import OperatorPanel from './features/production/components/OperatorPanel';
import Login from './components/Login';
import RequireAuth from './components/RequireAuth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePushNotifications } from './hooks/usePushNotifications';

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
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#fff',
              color: '#334155',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
            },
          }}
        />

        <Routes>
          {/* Default redirect to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public Login */}
          <Route path="/login" element={<Login />} />

          {/* Admin / Manager Dashboard */}
          <Route
            path="/admin"
            element={
              <RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}>
                <AdminDashboard />
              </RequireAuth>
            }
          />

          {/* Operator Line Panel */}
          <Route
            path="/line/:id/operator"
            element={
              <RequireAuth>
                <OperatorPanel />
              </RequireAuth>
            }
          />

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
    </QueryClientProvider>
  );
}

export default App;
