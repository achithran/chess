import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { useLanguageStore } from "@/store/language";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  plan: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  fetchPlan: () => Promise<void>;
}

function _saveTokens(tokens: { access_token: string; refresh_token: string }) {
  window.localStorage.setItem("cm_access_token", tokens.access_token);
  window.localStorage.setItem("cm_refresh_token", tokens.refresh_token);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      email: null,
      plan: null,
      isAuthenticated: false,
      login: async (email, password) => {
        const tokens = await api.login(email, password);
        _saveTokens(tokens);
        set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, email, isAuthenticated: true });
        try { const me = await api.me(); set({ plan: me.plan }); } catch { /* non-critical */ }
      },
      register: async (email, password, name) => {
        const tokens = await api.register(email, password, name);
        _saveTokens(tokens);
        set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, email, isAuthenticated: true });
        try { const me = await api.me(); set({ plan: me.plan }); } catch { /* non-critical */ }
      },
      logout: () => {
        window.localStorage.removeItem("cm_access_token");
        window.localStorage.removeItem("cm_refresh_token");
        useLanguageStore.getState().setCode("en");
        set({ accessToken: null, refreshToken: null, email: null, plan: null, isAuthenticated: false });
      },
      fetchPlan: async () => {
        try { const me = await api.me(); set({ plan: me.plan }); } catch { /* ignore */ }
      },
    }),
    { name: "cm-auth" }
  )
);
