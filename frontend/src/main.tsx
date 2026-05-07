import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle "Failed module loading" / ChunkLoadError for zero-downtime deployment resilience
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
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
