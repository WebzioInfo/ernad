import axios, { AxiosError } from 'axios';
import useAuthStore from './store/useAuthStore';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const getBaseURL = () => {
  const url = import.meta.env.VITE_API_URL;
  if (url) return url;
  
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:4000/api';
  }
  
  // Production Safety Warning
  console.error('%c[FATAL] VITE_API_URL is missing in production environment.', 'color: white; background: red; padding: 4px; font-weight: bold;');
  return '/api';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000, // Enterprise timeout
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// ── REQUEST INTERCEPTOR (TRACING & AUTH) ──
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Enterprise Tracing
  const requestId = uuidv4();
  config.headers['x-mes-request-id'] = requestId;
  config.headers['x-vercel-protection-skip'] = 'true';

  if (window.location.hostname === 'localhost') {
    console.log(`%c[RESILIENT_API] OUT -> ${config.method?.toUpperCase()} ${config.url}`, 'color: #3b82f6; font-weight: bold;', { requestId, data: config.data });
  }

  return config;
});

// ── RESPONSE INTERCEPTOR (ERROR MAPPING & RETRY) ──
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config;
    
    // 1. Handle Network/CORS Errors
    if (!error.response) {
      console.error('%c[CORS_OR_NETWORK_FAILURE] The request was blocked or the server is unreachable.', 'color: #ef4444; font-weight: bold;', {
        url: config?.url,
        method: config?.method,
        origin: window.location.origin
      });
      
      // Retry once for GET requests if it looks like a transient network issue
      if (config && config.method === 'get' && !(config as any)._retry) {
        (config as any)._retry = true;
        console.warn('[RETRYING] Transient network error, attempting one last time...');
        return api(config);
      }
    }

    // 2. Handle 401 Unauthorized
    if (error.response?.status === 401) {
      const isLoginRequest = config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        useAuthStore.getState().logout();
        toast.error('Session expired. Please log in again.');
      }
    }

    // 3. Handle 403 Forbidden (Audit Logged)
    if (error.response?.status === 403) {
      console.error('[AUTH_REJECTION] 403 Forbidden. Current roles/permissions insufficient for this resource.');
      toast.error('Access Denied: Insufficient Privileges');
    }

    return Promise.reject(error);
  }
);
