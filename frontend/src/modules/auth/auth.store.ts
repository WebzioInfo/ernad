import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../../types/database.types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  setInitialized: (val: boolean) => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true, isInitialized: true }),
      logout: () => {
        set({ token: null, user: null, isAuthenticated: false, isInitialized: true });
        try {
          localStorage.clear();
          sessionStorage.clear();
          if (typeof window !== 'undefined' && 'caches' in window) {
            caches.keys().then((names) => {
              names.forEach(name => caches.delete(name));
            });
          }
        } catch (err) {
          console.error('Error clearing storage or cache:', err);
        }
        setTimeout(() => {
          window.location.href = '/login';
        }, 150);
      },
      setInitialized: (val) => set({ isInitialized: val }),
    }),
    {
      name: 'ernad-auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setInitialized(true);
      },
    }
  )
);

export default useAuthStore;
