import { registerApiAuthLifecycle } from '@/src/core/api';
import { cartEngine } from '@/src/core/cart/cart-engine';
import { pushEngine } from '@/src/core/push/push-engine';
import { clearUserScopedQueries } from '@/lib/sign-out-query-teardown';
import { persistCustomerSessionCookie } from '@/services/kokobay-web/customer-session';
import { invalidateMarketingConsentCache } from '@/services/kokobay-web/marketing-consent';
import {
  cancelAppBenefitsBackgroundRefresh,
  refreshAppBenefits,
  refreshAppBenefitsInBackground,
} from '@/src/core/query/app-benefits-query';
import { useCartStore } from '@/store/cart';
import { logCartStateTransition } from '@/lib/cart-perf-log';
import { finishSignOutPerfRun, logSignOutPerf } from '@/lib/sign-out-perf';
import { getCartRevisionSnapshot } from '@/store/cart';

import { shouldRunPostAuthEffects } from './auth-machine';
import { getAuthAccessToken } from './token';
import type { AuthStatus } from './types';
import { isAuthenticatedStatus } from './types';

type AuthStoreSnapshot = {
  status: AuthStatus;
  user: { id: string; email: string } | null;
  accessToken: string | null;
};

type AuthStoreLike = {
  getState: () => AuthStoreSnapshot & {
    applyRefreshedToken: (token: string) => void;
    applySessionInvalid: () => void;
  };
  subscribe: (listener: (state: AuthStoreSnapshot, prev: AuthStoreSnapshot) => void) => () => void;
};

function logAuthCartFlush(source: string, customerEmail?: string): void {
  const { lines, hasHydrated } = useCartStore.getState();
  const { cartRevision, lastSyncedRevision, isCartDirty } = getCartRevisionSnapshot();
  logCartStateTransition(source, lines.length, cartRevision, {
    hasHydrated,
    lastSyncedRevision,
    isCartDirty,
    customerEmail: customerEmail ?? null,
  });
}

function scheduleCartMerge(email: string): void {
  logAuthCartFlush('auth_engine:mergeGuestCart', email);
  if (!useCartStore.getState().hasHydrated) {
    cartEngine.deferMergeOnLogin(email);
    return;
  }
  void cartEngine.mergeOnLogin(email);
}

function runPostAuthEffects(email: string, accessToken: string): void {
  void (async () => {
    const discount = await import('@/services/cart/auto-first-app-order-discount');
    discount.resetFirstAppOrderDiscountAutoApplyState();
    clearUserScopedQueries();

    try {
      scheduleCartMerge(email);
      await refreshAppBenefits(accessToken, {
        force: true,
        applyDiscount: false,
      });
      await cartEngine.applyAutoDiscount(email);
    } catch {
      /* Best-effort — checkout re-syncs cart when needed. */
    }
  })();
}

function runSignOutBackgroundTasks(
  email: string | undefined,
  accessToken: string | null,
  perfRunId?: string,
): void {
  void (async () => {
    try {
      await pushEngine.runSignOutBackground(email);

      if (accessToken?.trim()) {
        const logoutStart = performance.now();
        const { getAuthService } = await import('@/services/auth');
        await getAuthService().logout().catch(() => {});
        logSignOutPerf('server_logout_complete', {
          ms: Math.round(performance.now() - logoutStart),
        });
      }

      const cartStart = performance.now();
      await cartEngine.clearRemote();
      logSignOutPerf('cart_clear_complete', {
        ms: Math.round(performance.now() - cartStart),
      });
    } finally {
      if (perfRunId) finishSignOutPerfRun(perfRunId);
    }
  })();
}

/**
 * Auth workflow — session transitions, cart merge, benefits, sign-out orchestration.
 * Call once at app startup — not from screens.
 */
export function startAuthEngine(useAuthStore: AuthStoreLike): () => void {
  registerApiAuthLifecycle({
    onSessionRefreshed: (token) => {
      useAuthStore.getState().applyRefreshedToken(token);
    },
    onSessionInvalid: () => {
      useAuthStore.getState().applySessionInvalid();
    },
  });

  let prev: AuthStoreSnapshot = useAuthStore.getState();

  const unsubscribe = useAuthStore.subscribe((state) => {
    const previous = prev;
    prev = {
      status: state.status,
      user: state.user,
      accessToken: state.accessToken,
    };

    if (
      shouldRunPostAuthEffects(
        previous.status,
        state.status,
        previous.user?.id,
        state.user?.id,
      ) &&
      state.user &&
      state.accessToken
    ) {
      runPostAuthEffects(state.user.email, state.accessToken);
      return;
    }

    const wasAuthenticated = isAuthenticatedStatus(previous.status);
    const isAuthenticated = isAuthenticatedStatus(state.status);

    if (wasAuthenticated && !isAuthenticated && state.status === 'UNAUTHENTICATED') {
      invalidateMarketingConsentCache();
      cancelAppBenefitsBackgroundRefresh();
      void import('@/services/cart/auto-first-app-order-discount')
        .then((mod) => mod.resetFirstAppOrderDiscountAutoApplyState())
        .catch(() => {});
    }

    if (
      isAuthenticated &&
      state.user &&
      previous.user?.id === state.user.id &&
      previous.status !== state.status &&
      state.status === 'AUTHENTICATED'
    ) {
      const token = getAuthAccessToken();
      if (token) refreshAppBenefitsInBackground(token);
    }
  });

  return unsubscribe;
}

export function runImmediateSignOutCleanup(snapshot: {
  user: { email: string } | null;
  accessToken: string | null;
}): void {
  clearUserScopedQueries();
  void persistCustomerSessionCookie(null);
  cartEngine.resetOnSignOut();
  void snapshot;
}

export function runSignOutBackground(
  email: string | undefined,
  accessToken: string | null,
  perfRunId?: string,
): void {
  runSignOutBackgroundTasks(email, accessToken, perfRunId);
}

/** @deprecated Use {@link startAuthEngine} */
export const startAuthSideEffects = startAuthEngine;
