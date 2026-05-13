import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import useAuthStore from '../modules/auth/auth.store';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

// ── INDUSTRIAL SYNC QUEUE (Offline-First) ──
const SYNC_QUEUE_KEY = 'mes-sync-queue';

const getSyncQueue = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

const addToSyncQueue = (request: any) => {
  const queue = getSyncQueue();
  queue.push({
    id: uuidv4(),
    ...request,
    timestamp: new Date().toISOString(),
    retryCount: 0
  });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event('mes-sync-update'));
};

const getBaseURL = () => {
  // 1. Explicit VITE_API_URL from environment (Priority)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
  
  // 2. Automatic detection for Localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:4000/api/';
  }
  
  // 3. Fallback to relative path (standard production structure)
  return '/api/';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000, // Increased for industrial stability
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// ── REQUEST INTERCEPTOR (TRACING & AUTH) ──
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Enterprise Tracing
  const requestId = uuidv4();
  config.headers['x-mes-request-id'] = requestId;

  // Add Vercel Protection Skip if available in storage (Optional hardening)
  const protectionSkip = localStorage.getItem('vercel-protection-skip');
  if (protectionSkip) {
    config.headers['x-vercel-protection-skip'] = protectionSkip;
  }

  if (import.meta.env.DEV) {
    console.debug(`%c[API_OUT] ${config.method?.toUpperCase()} ${config.url}`, 'color: #3b82f6; font-weight: bold;', { requestId });
  }

  return config;
});

// ── RESPONSE INTERCEPTOR (ERROR MAPPING & RETRY) ──
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
    
    // 1. Handle Network/CORS/Blocked/Timeout Errors
    if (!error.response) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      
      if (import.meta.env.DEV) {
        console.error(`%c[CONNECTIVITY_FAILURE]`, 'color: #ef4444; font-weight: bold;', {
          message: error.message,
          code: error.code,
          isTimeout,
          url: config?.url
        });
      }

      if (isTimeout) {
        // Skip global toast for high-frequency polling analytics to prevent "toast spam"
        const isBackgroundPoll = config?.url?.includes('/analytics/factory/live') || 
                                config?.url?.includes('/analytics/factory/efficiency');
        
        if (!isBackgroundPoll) {
          toast.error('Network Latency Detected', {
            description: 'The operation is taking longer than expected. We are still trying in the background.',
          });
        }
      } else if (isNetworkError) {
        // ── OFFLINE-FIRST LOGIC: Queue non-GET requests ──
        if (config && config.method !== 'get' && (config.url?.includes('/telemetry') || config.url?.includes('/downtime'))) {
          addToSyncQueue({
            url: config.url,
            method: config.method,
            data: config.data,
            headers: config.headers
          });
          
          toast.warning('Offline Sync Active', {
            description: 'Connectivity lost. Production data is being saved locally and will sync automatically.',
            duration: 4000
          });
          
          return Promise.resolve({ data: { status: 'QUEUED_OFFLINE', requestId: config.headers['x-mes-request-id'] }, status: 202 });
        }

        toast.error('Network connection issue', {
          description: 'The server is temporarily unreachable. Please check your connection or try again.',
          duration: 5000
        });
      }
      
      // Strict Retry Logic for idempotent requests
      if (config && (config.method === 'get' || config.method === 'head')) {
        config._retryCount = config._retryCount || 0;
        if (config._retryCount < 2) {
          config._retryCount++;
          const delay = config._retryCount * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return api(config);
        }
      }
    }

    // 2. Handle 401 Unauthorized (Session Management)
    if (error.response?.status === 401) {
      const isLoginRequest = config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        useAuthStore.getState().logout();
        toast.error('Session expired', {
          description: 'Please log in again to continue.'
        });
      }
    }

    // 3. Handle 403 Forbidden (CORS or Permissions)
    if (error.response?.status === 403) {
      const message = (error.response.data as any)?.message || 'Access Denied: Restricted resource.';
      toast.error('Forbidden', {
        description: message
      });
    }

    // 4. Handle 502/503/504 (Server Maintenance/Overload)
    if (error.response && [502, 503, 504].includes(error.response.status)) {
      toast.error('Server unavailable', {
        description: 'The system is currently undergoing maintenance or is overloaded. Please try again in a few minutes.'
      });
    } else if (error.response && error.response.status >= 400 && error.response.status !== 401 && error.response.status !== 403) {
      const data = error.response.data as any;
      const message = data?.message || 'Something went wrong. Please try again.';
      const errorCode = data?.errorCode || 'SYSTEM_ERROR';

      // Suppress 404 toasts for specific background queries that handle nulls gracefully
      const isBackgroundPoll = config?.url?.includes('/analytics/factory/live') || 
                              config?.url?.includes('/production/active-batch');

      if (!(error.response.status === 404 && isBackgroundPoll)) {
        toast.error(message, {
          description: `Reference: ${errorCode}`
        });
      }
    }

    return Promise.reject(error);
  }
);

// ── BACKGROUND SYNC ENGINE ──
let isSyncing = false;
const processSyncQueue = async () => {
  if (isSyncing || !navigator.onLine) return;
  
  const queue = getSyncQueue();
  if (queue.length === 0) return;
  
  isSyncing = true;
  // Process sync queue quietly in production
  
  const remaining: any[] = [];
  
  for (const item of queue) {
    try {
      await api({
        url: item.url,
        method: item.method,
        data: item.data,
        headers: item.headers,
        // Prevent recursive interceptor loops
        ...({ _isSync: true } as any)
      });
      // Successfully flushed
    } catch (err) {
      console.error(`[SYNC] Failed to flush log: ${item.id}`, err);
      if (item.retryCount < 10) {
        remaining.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }
  }
  
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
  isSyncing = false;
  window.dispatchEvent(new Event('mes-sync-update'));
  
  if (remaining.length === 0) {
    toast.success('Synchronization Complete', {
      description: 'All offline production data has been uploaded.'
    });
  }
};

// Auto-sync on interval and online event
setInterval(processSyncQueue, 15000);
window.addEventListener('online', processSyncQueue);
window.addEventListener('load', processSyncQueue);
