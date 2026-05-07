import { BrowserRouter as Router } from 'react-router-dom';
import { Providers } from './app/providers';
import { AppRoutes } from './app/routes';
import { ErrorBoundary } from './app/ErrorBoundary';
import { LoadingScreen } from './components/common/LoadingScreen';
import useAuthStore from './modules/auth/auth.store';
import { usePushNotifications } from './hooks/usePushNotifications';

function AppInner() {
  usePushNotifications();
  return null;
}

function App() {
  const { isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <LoadingScreen message="Booting MES Shell..." />;
  }

  return (
    <ErrorBoundary>
      <Providers>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppInner />
          <div className="min-h-screen bg-slate-50">
            <AppRoutes />
          </div>
        </Router>
      </Providers>
    </ErrorBoundary>
  );
}

export default App;
