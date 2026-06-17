import { BrowserRouter as Router } from 'react-router-dom';
import { Providers } from './app/providers';
import { AppRoutes } from './app/routes';
import { LoadingScreen } from './components/common/LoadingScreen';
import useAuthStore from './modules/auth/auth.store';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useWebSocket } from './hooks/useWebSocket';
import { UpdatePrompt } from './components/common/UpdatePrompt';

function AppInner() {
  usePushNotifications();
  useWebSocket();
  return null;
}

function App() {
  const { isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <LoadingScreen message="Booting MES Shell..." />;
  }

  return (
    <Providers>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppInner />
        <div className="min-h-screen bg-slate-50">
          <AppRoutes />
        </div>
      </Router>
      <UpdatePrompt />
    </Providers>
  );
}

export default App;
