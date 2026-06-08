import { create } from 'zustand';

import { getAuthService } from '@/services/auth';
import type { AuthResult, PasswordResetResult, RegisterInput } from '@/services/auth/types';
import { persistCustomerSessionCookie } from '@/services/kokobay-web/customer-session';
import type { AuthSession, AuthUser } from '@/types/auth';
import {
  sessionStateFromLogin,
  sessionStateFromRestoreOutcome,
  unauthenticatedState,
} from '@/src/core/auth/auth-machine';
import { runImmediateSignOutCleanup, runSignOutBackground } from '@/src/core/auth/auth-engine';
import { restoreAuthSession } from '@/src/core/auth/restore-session';
import type { AuthStatus } from '@/src/core/auth/types';

import { recordHydration } from '@/lib/lifecycle-perf';
import { trackLogin, trackSignUp } from '@/lib/gtm';
import {
  beginSignOutPerfRun,
  finishSignOutPerfRun,
  logSignOutPerf,
  markSignOutPerf,
} from '@/lib/sign-out-perf';

import { persistSession } from './auth-persist';

type SignOutOptions = {
  /** Skip `POST /api/customer/auth/logout` (account already deleted server-side). */
  skipServerLogout?: boolean;
};

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  /** Internal — use `getAuthAccessToken()` from services, not in screens. */
  accessToken: string | null;
  errorMessage: string | null;
  /** @deprecated Use `status !== 'RESTORING'` or `useAuth().isReady` */
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  retryRestore: () => Promise<void>;
  applyRefreshedToken: (accessToken: string) => void;
  applySessionInvalid: () => void;
  patchUser: (patch: Partial<AuthUser>) => void;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  logout: () => Promise<void>;
  clearSessionAfterAccountDeletion: () => Promise<void>;
};

function syncHasHydrated(status: AuthStatus): boolean {
  return status !== 'RESTORING';
}

function applyAuthenticatedSession(
  set: (partial: Partial<AuthState>) => void,
  session: AuthSession,
): void {
  const next = sessionStateFromLogin(session);
  set({
    status: next.status,
    user: next.user,
    accessToken: next.accessToken,
    errorMessage: next.errorMessage,
    hasHydrated: true,
  });
  void persistCustomerSessionCookie(session.accessToken);
}

async function runRestore(set: (partial: Partial<AuthState>) => void, get: () => AuthState): Promise<void> {
  if (get().status !== 'RESTORING' && get().hasHydrated) return;

  set({ status: 'RESTORING', errorMessage: null });

  const outcome = await restoreAuthSession();

  if (outcome.kind === 'unauthenticated') {
    await persistCustomerSessionCookie(null);
  }

  const next = sessionStateFromRestoreOutcome(outcome);
  set({
    status: next.status,
    user: next.user,
    accessToken: next.accessToken,
    errorMessage: next.errorMessage,
    hasHydrated: syncHasHydrated(next.status),
  });

  if (outcome.kind === 'authenticated' && outcome.session.accessToken) {
    await persistCustomerSessionCookie(outcome.session.accessToken);
  }
}

function performSignOut(
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState,
  options: SignOutOptions = {},
): void {
  const perfRunId = beginSignOutPerfRun();
  const email = get().user?.email;
  const accessToken = get().accessToken;
  runImmediateSignOutCleanup({ user: get().user, accessToken });

  markSignOutPerf('user_queries_cancelled');
  void persistSession(null);

  const cleared = unauthenticatedState();
  set({
    status: cleared.status,
    user: cleared.user,
    accessToken: cleared.accessToken,
    errorMessage: cleared.errorMessage,
    hasHydrated: true,
  });
  markSignOutPerf('auth_state_cleared');

  runSignOutBackground(email, options.skipServerLogout ? null : accessToken, perfRunId);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'RESTORING',
  user: null,
  accessToken: null,
  errorMessage: null,
  hasHydrated: false,

  hydrate: async () => {
    if (__DEV__) recordHydration('auth', get().hasHydrated);
    if (get().hasHydrated) return;
    await runRestore(set, get);
  },

  retryRestore: async () => {
    set({ hasHydrated: false, status: 'RESTORING', errorMessage: null });
    await runRestore(set, get);
  },

  applyRefreshedToken: (accessToken) => {
    const token = accessToken.trim();
    if (!token) return;
    set({ accessToken: token });
    const user = get().user;
    if (user) {
      void persistSession({ accessToken: token, user });
    }
  },

  applySessionInvalid: () => {
    void persistCustomerSessionCookie(null);
    void persistSession(null);
    const cleared = unauthenticatedState();
    set({
      status: cleared.status,
      user: cleared.user,
      accessToken: cleared.accessToken,
      errorMessage: cleared.errorMessage,
      hasHydrated: true,
    });
  },

  patchUser: (patch) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...patch } });
  },

  login: async (email, password) => {
    const result = await getAuthService().login(email, password);
    if (result.ok) {
      trackLogin();
      applyAuthenticatedSession(set, result.session);
    }
    return result;
  },

  register: async (input) => {
    const result = await getAuthService().register(input);
    if (result.ok) {
      trackSignUp();
      applyAuthenticatedSession(set, result.session);
    }
    return result;
  },

  requestPasswordReset: (email) => getAuthService().requestPasswordReset(email),

  logout: async () => {
    performSignOut(set, get);
  },

  clearSessionAfterAccountDeletion: async () => {
    await persistCustomerSessionCookie(null);
    performSignOut(set, get, { skipServerLogout: true });
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
