import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface AuthState {
  accessToken: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      email: null,
      isAuthenticated: false,
      login: async (email, password) => {
        const tokens = await api.login(email, password);
        window.localStorage.setItem("cm_access_token", tokens.access_token);
        set({ accessToken: tokens.access_token, email, isAuthenticated: true });
      },
      register: async (email, password, name) => {
        const tokens = await api.register(email, password, name);
        window.localStorage.setItem("cm_access_token", tokens.access_token);
        set({ accessToken: tokens.access_token, email, isAuthenticated: true });
      },
      logout: () => {
        window.localStorage.removeItem("cm_access_token");
        set({ accessToken: null, email: null, isAuthenticated: false });
      },
    }),
    { name: "cm-auth" }
  )
);
