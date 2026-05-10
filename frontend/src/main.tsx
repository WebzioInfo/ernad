import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerModules } from './app/registry';

// Initialize ERP Module Registry
registerModules();

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

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch(err => console.error('[PWA] Service Worker registration failed:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
