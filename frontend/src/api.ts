import axios from 'axios';
import useAuthStore from './store/useAuthStore';
import { toast } from 'sonner';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (window.location.hostname === 'localhost') return 'http://localhost:4000/api';
  // Default to relative /api which works if front and back are on same domain or proxied
  return '/api';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Bypass Vercel Deployment Protection if configured
  config.headers['x-vercel-protection-skip'] = 'true';

  // GLOBAL LOGGER (Localhost only)
  if (window.location.hostname === 'localhost') {
    console.log(`%c[OUTGOING] ${config.method?.toUpperCase()} ${config.url}`, 'color: #3b82f6; font-weight: bold;', config.data || '');
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (window.location.hostname === 'localhost') {
      console.log(`%c[INCOMING] ${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`, 'color: #10b981; font-weight: bold;', response.data);
    }
    return response;
  },
  (error) => {
    if (window.location.hostname === 'localhost') {
      console.error(`%c[ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url} -> ${error.response?.status}`, 'color: #ef4444; font-weight: bold;', error.response?.data || error.message);
    }

    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        useAuthStore.getState().logout();
        toast.error('Session expired. Please log in again.');
      }
    }
    return Promise.reject(error);
  }
);
