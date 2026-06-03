import { create } from 'zustand';

import { getAuthService } from '@/services/auth';
import type { AuthResult, PasswordResetResult, RegisterInput, RestoreSessionResult } from '@/services/auth/types';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { persistCustomerSessionCookie } from '@/services/kokobay-web/customer-session';
import type { AuthSession, AuthUser } from '@/types/auth';

import { recordHydration } from '@/lib/lifecycle-perf';
import { trackLogin, trackSignUp } from '@/lib/gtm';
import {
  pausePushRegistrationForSignOut,
  registerPushNotifications,
  resumePushRegistrationAfterSignOut,
  unregisterPushNotifications,
} from '@/lib/pushNotifications';
import { teardownUserQueriesOnSignOut } from '@/lib/sign-out-query-teardown';
import {
  beginSignOutPerfRun,
  finishSignOutPerfRun,
  logSignOutPerf,
  markSignOutPerf,
} from '@/lib/sign-out-perf';
import { invalidateMarketingConsentCache } from '@/services/kokobay-web/marketing-consent';

import { loadPersistedSession, persistSession } from './auth-persist';
import {
  cancelAppBenefitsBackgroundRefresh,
  refreshAppBenefitsInBackground,
  useAppBenefitsStore,
} from './app-benefits';
import {
  clearRemoteCartInBackground,
  getCartRevisionSnapshot,
  mergeGuestCartOnLogin,
  resetCartForSignOut,
  useCartStore,
} from './cart';
import { logCartStateTransition } from '@/lib/cart-perf-log';

function logAuthHydrateCartFlush(source: string, customerEmail?: string): void {
  const { lines, hasHydrated } = useCartStore.getState();
  const { cartRevision, lastSyncedRevision, isCartDirty } = getCartRevisionSnapshot();
  logCartStateTransition(source, lines.length, cartRevision, {
    hasHydrated,
    lastSyncedRevision,
    isCartDirty,
    customerEmail: customerEmail ?? null,
  });
}

function authHydrateFlushCartSync(customerEmail?: string): void {
  logAuthHydrateCartFlush('auth_hydrate:mergeGuestCart', customerEmail);
  if (!customerEmail?.trim()) return;
  void mergeGuestCartOnLogin(customerEmail);
}

/** Attach session immediately; merge guest cart + benefits in the background (non-blocking UI). */
async function completeAuthenticatedCartSetup(session: AuthSession): Promise<void> {
  const discount = await import('@/services/cart/auto-first-app-order-discount');
  discount.resetFirstAppOrderDiscountAutoApplyState();
  useAppBenefitsStore.getState().clear();
  useAuthStore.getState().setSession(session);

  void (async () => {
    try {
      await mergeGuestCartOnLogin(session.user.email);
      await useAppBenefitsStore.getState().refresh(session.accessToken, {
        force: true,
        applyDiscount: false,
      });
      await discount.maybeAutoApplyFirstAppOrderDiscountAsync(session.user.email);
    } catch {
      /* Cart/benefits setup is best-effort; checkout calls ensureCartSyncedForCheckout. */
    }
  })();
}

type SignOutOptions = {
  /** Skip `POST /api/customer/auth/logout` (account already deleted server-side). */
  skipServerLogout?: boolean;
};

/**
 * Clear local session + bag immediately; push/unregister and remote cart clear run in background.
 * Wishlist is untouched (separate store).
 */
function performSignOut(options: SignOutOptions = {}): void {
  const perfRunId = beginSignOutPerfRun();
  const email = useAuthStore.getState().user?.email;
  const accessToken = useAuthStore.getState().accessToken;

  pausePushRegistrationForSignOut();
  teardownUserQueriesOnSignOut();
  markSignOutPerf('user_queries_cancelled');

  const serverLogoutPromise =
    !options.skipServerLogout && accessToken?.trim() ?
      getAuthService()
        .logout()
        .catch(() => {})
    : Promise.resolve();

  resetCartForSignOut();
  cancelAppBenefitsBackgroundRefresh();
  useAppBenefitsStore.getState().clear();
  void import('@/services/cart/auto-first-app-order-discount')
    .then((mod) => {
      mod.resetFirstAppOrderDiscountAutoApplyState();
    })
    .catch(() => {});
  invalidateMarketingConsentCache();
  useAuthStore.getState().clearSession();
  markSignOutPerf('auth_state_cleared');

  void (async () => {
    try {
      const pushStart = performance.now();
      await unregisterPushNotifications(email).catch(() => {});
      logSignOutPerf('push_unregister_complete', {
        ms: Math.round(performance.now() - pushStart),
      });

      const logoutStart = performance.now();
      await serverLogoutPromise;
      logSignOutPerf('server_logout_complete', {
        ms: Math.round(performance.now() - logoutStart),
      });

      const cartStart = performance.now();
      await clearRemoteCartInBackground();
      logSignOutPerf('cart_clear_complete', {
        ms: Math.round(performance.now() - cartStart),
      });
    } finally {
      resumePushRegistrationAfterSignOut();
      const guestPushStart = performance.now();
      const guestPush = await registerPushNotifications(undefined, 'sign_out_guest');
      logSignOutPerf('push_guest_register_complete', {
        ms: Math.round(performance.now() - guestPushStart),
        skipped: Boolean(guestPush.ok && guestPush.skipped),
      });
      finishSignOutPerfRun(perfRunId);
    }
  })();
}

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  patchUser: (patch: Partial<AuthUser>) => void;
  clearSession: () => void;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  logout: () => Promise<void>;
  /** After instant account deletion — skip server logout (customer no longer exists). */
  clearSessionAfterAccountDeletion: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  hasHydrated: false,

  hydrate: async () => {
    if (__DEV__) recordHydration('auth', get().hasHydrated);
    if (get().hasHydrated) return;

    const restored: RestoreSessionResult = await getAuthService().restoreSession();

    if (restored.status === 'ok') {
      set({
        user: restored.session.user,
        accessToken: restored.session.accessToken,
        hasHydrated: true,
      });
      refreshAppBenefitsInBackground(restored.session.accessToken);
      authHydrateFlushCartSync(restored.session.user.email);
      return;
    }

    if (restored.status === 'session_unknown') {
      // Session validity unknown because network/server failed — keep last known session in memory + SecureStore.
      const local = await loadPersistedSession();
      if (local) {
        set({ user: local.user, accessToken: local.accessToken, hasHydrated: true });
        refreshAppBenefitsInBackground(local.accessToken);
        authHydrateFlushCartSync(local.user.email);
        return;
      }
      set({ user: null, accessToken: null, hasHydrated: true });
      return;
    }

    if (restored.status === 'session_invalid') {
      // Server confirmed unauthorized / expired — clear stored credentials.
      await persistCustomerSessionCookie(null);
      set({ user: null, accessToken: null, hasHydrated: true });
      return;
    }

    // no_session — nothing stored locally (or API not configured).
    if (!isKokobayWebProductsConfigured()) {
      const session = await loadPersistedSession();
      if (session) {
        set({ user: session.user, accessToken: session.accessToken, hasHydrated: true });
        refreshAppBenefitsInBackground(session.accessToken);
        authHydrateFlushCartSync(session.user.email);
      } else {
        set({ user: null, accessToken: null, hasHydrated: true });
      }
      return;
    }

    set({ user: null, accessToken: null, hasHydrated: true });
  },

  setSession: (session) => {
    set({ user: session.user, accessToken: session.accessToken });
    void persistCustomerSessionCookie(session.accessToken);
    void registerPushNotifications(session.user.email, 'set_session');
  },

  patchUser: (patch) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...patch } });
  },

  clearSession: () => {
    set({ user: null, accessToken: null });
  },

  login: async (email, password) => {
    const result = await getAuthService().login(email, password);
    if (result.ok) {
      trackLogin();
      await completeAuthenticatedCartSetup(result.session);
    }
    return result;
  },

  register: async (input) => {
    const result = await getAuthService().register(input);
    if (result.ok) {
      trackSignUp();
      await completeAuthenticatedCartSetup(result.session);
    }
    return result;
  },

  requestPasswordReset: (email) => getAuthService().requestPasswordReset(email),

  logout: async () => {
    performSignOut();
  },

  clearSessionAfterAccountDeletion: async () => {
    await persistCustomerSessionCookie(null);
    performSignOut({ skipServerLogout: true });
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
