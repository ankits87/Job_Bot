import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  _hydrated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setToken: (token: string) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      _hydrated: false,
      setAuth: (token, user) => set({ token, user }),
      setToken: (token) => set({ token }),
      logout: () => set({ token: null, user: null }),
      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: "auth",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
