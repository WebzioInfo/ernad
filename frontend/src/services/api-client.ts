import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import useAuthStore from '../modules/auth/auth.store';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const getBaseURL = () => {
  // 1. Explicit VITE_API_URL from environment (Priority)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  
  // 2. Automatic detection for Localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:4000/api';
  }
  
  // 3. Fallback to relative path (assuming same domain deployment)
  return '/api';
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
    
    // 1. Handle Network/CORS/Blocked Errors
    if (!error.response) {
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message === 'Network Error';
      
      if (import.meta.env.DEV) {
        console.error(`%c[NETWORK_FAILURE]`, 'color: #ef4444; font-weight: bold;', {
          message: error.message,
          code: error.code,
          url: config?.url
        });
      }

      if (isNetworkError) {
        toast.error('Network Error: The server is unreachable. This may be caused by a CORS block or a down server.', {
          description: 'Please check your internet connection and verify the backend status.',
          duration: 5000
        });
      }
      
      // Strict Retry Logic for idempotent requests
      if (config && (config.method === 'get' || config.method === 'head')) {
        config._retryCount = config._retryCount || 0;
        if (config._retryCount < 2) {
          config._retryCount++;
          const delay = config._retryCount * 1000;
          console.warn(`[RETRY] Attempt ${config._retryCount} for ${config.url} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return api(config);
        }
      }
    }

    // 2. Handle 401 Unauthorized (Session Management)
    if (error.response?.status === 401) {
      const isLoginRequest = config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        console.warn('[AUTH] 401 Unauthorized. Clearing session.');
        useAuthStore.getState().logout();
        toast.error('Session expired. Please log in again.');
      }
    }

    // 3. Handle 403 Forbidden (CORS or Permissions)
    if (error.response?.status === 403) {
      console.error('[SECURITY] 403 Forbidden rejection.', {
        url: config?.url,
        data: error.response.data
      });
      
      const message = (error.response.data as any)?.message || 'Access Denied: You do not have permission to perform this action.';
      toast.error(message);
    }

    // 4. Handle 5xx Errors
    if (error.response && error.response.status >= 500) {
      toast.error('Server Error', {
        description: 'The manufacturing system encountered an internal error. Our team has been notified.'
      });
    }

    return Promise.reject(error);
  }
);
