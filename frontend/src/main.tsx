import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerModules } from './app/registry';

// Initialize ERP Module Registry
registerModules();

// Global Error Boundary for Chunk Load Errors (PWA fallback)
class GlobalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, _errorInfo: any) {
    const isChunkError = 
      error.message?.toLowerCase().includes('chunk') || 
      error.message?.toLowerCase().includes('loading module');
      
    if (isChunkError) {
      console.error('[DEPLOYMENT_SYNC_ERROR] Static asset mismatch detected. Force-refreshing application...');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
          <h2>Application Updating...</h2>
          <p>We've detected a new version of the app. Please wait while we refresh.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '0.5rem 1rem', background: '#1A9A91', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}
          >
            Force Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener('error', (event) => {
  const isChunkError = 
    event.message?.toLowerCase().includes('chunk') || 
    event.message?.toLowerCase().includes('loading module');
    
  if (isChunkError) {
    console.error('[DEPLOYMENT_SYNC_ERROR] Static asset mismatch detected. Force-refreshing application...');
    window.location.reload();
  }
}, true);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
