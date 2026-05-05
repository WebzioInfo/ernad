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
  factoryId: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'ernad-auth-storage', // unique name
    }
  )
);

export default useAuthStore;
