import { create } from 'zustand';

import { getAuthService } from '@/services/auth';
import type { AuthResult, PasswordResetResult, RegisterInput } from '@/services/auth/types';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { persistCustomerSessionCookie } from '@/services/kokobay-web/customer-session';
import type { AuthSession, AuthUser } from '@/types/auth';

import { trackLogin, trackSignUp } from '@/lib/gtm';
import { registerPushNotifications, unregisterPushNotifications } from '@/lib/pushNotifications';

import { loadPersistedSession, persistSession } from './auth-persist';
import { flushCartSync } from './cart';

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  hasHydrated: false,

  hydrate: async () => {
    if (get().hasHydrated) return;
    const fromApi = await getAuthService().restoreSession();
    if (fromApi) {
      set({ user: fromApi.user, accessToken: fromApi.accessToken, hasHydrated: true });
      return;
    }
    if (isKokobayWebProductsConfigured()) {
      set({ user: null, accessToken: null, hasHydrated: true });
      return;
    }
    const session = await loadPersistedSession();
    if (session) {
      set({ user: session.user, accessToken: session.accessToken, hasHydrated: true });
    } else {
      set({ user: null, accessToken: null, hasHydrated: true });
    }
  },

  setSession: (session) => {
    set({ user: session.user, accessToken: session.accessToken });
    void persistCustomerSessionCookie(session.accessToken);
    void registerPushNotifications(session.user.email);
  },

  clearSession: () => {
    set({ user: null, accessToken: null });
  },

  login: async (email, password) => {
    const result = await getAuthService().login(email, password);
    if (result.ok) {
      get().setSession(result.session);
      trackLogin();
      await flushCartSync(result.session.user.email);
    }
    return result;
  },

  register: async (input) => {
    const result = await getAuthService().register(input);
    if (result.ok) {
      get().setSession(result.session);
      trackSignUp();
      await flushCartSync(result.session.user.email);
    }
    return result;
  },

  requestPasswordReset: (email) => getAuthService().requestPasswordReset(email),

  logout: async () => {
    const email = get().user?.email;
    await unregisterPushNotifications(email);
    await getAuthService().logout();
    get().clearSession();
    await flushCartSync();
  },
}));

useAuthStore.subscribe((state, prev) => {
  if (!state.hasHydrated) return;
  const sameUser = state.user?.id === prev.user?.id && state.user?.email === prev.user?.email;
  const sameToken = state.accessToken === prev.accessToken;
  if (sameUser && sameToken) return;
  if (state.user && state.accessToken) {
    void persistSession({ accessToken: state.accessToken, user: state.user });
  } else {
    void persistSession(null);
  }
});

export type { AuthUser, AuthSession } from '@/types/auth';
