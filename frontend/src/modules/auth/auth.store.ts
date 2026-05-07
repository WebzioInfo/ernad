import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'OPERATOR_BLOWING' | 'OPERATOR_FILLING' | 'OPERATOR_LABELING' | 'OPERATOR_PACKING' | 'OPERATOR' | string;

interface User {
  id: string;
  name: string;
  role: UserRole;
  roles: string[];
  permissions: string[];
  avatarUrl?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (token: string, user: User) => void;
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
      logout: () => set({ token: null, user: null, isAuthenticated: false, isInitialized: true }),
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
