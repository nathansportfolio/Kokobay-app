import { create } from 'zustand';

import {
  fetchCustomerAppBenefits,
  invalidateAppBenefitsCache,
  type AppBenefitsEligibleDiscount,
} from '@/services/kokobay-web/app-benefits';
import { logAppFirstOrder } from '@/services/cart/app-first-order-log';
import { resolveCustomerSessionToken } from '@/services/kokobay-web/customer-session';

type AppBenefitsState = {
  isFirstAppOrder: boolean | null;
  appOrdersCount: number | null;
  eligibleDiscounts: AppBenefitsEligibleDiscount[];
  refresh: (
    sessionToken?: string | null,
    options?: { force?: boolean; applyDiscount?: boolean },
  ) => Promise<void>;
  clear: () => void;
};

const CART_REFRESH_DEBOUNCE_MS = 2_000;

let cartRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function logAppBenefits(payload: Record<string, unknown>): void {
  logAppFirstOrder('benefits', payload);
}

export const useAppBenefitsStore = create<AppBenefitsState>((set) => ({
  isFirstAppOrder: null,
  appOrdersCount: null,
  eligibleDiscounts: [],

  refresh: async (sessionToken, options) => {
    const token = sessionToken?.trim() || (await resolveCustomerSessionToken());
    if (!token) {
      logAppBenefits({ action: 'refresh_skip', reason: 'no_session_token' });
      return;
    }

    const result = await fetchCustomerAppBenefits(token, options);
    if (!result.ok) {
      logAppBenefits({ action: 'refresh_failed', force: options?.force === true });
      return;
    }

    set({
      isFirstAppOrder: result.benefits.isFirstAppOrder,
      appOrdersCount: result.benefits.appOrdersCount,
      eligibleDiscounts: result.benefits.eligibleDiscounts,
    });

    logAppBenefits({
      action: 'refresh_ok',
      isFirstAppOrder: result.benefits.isFirstAppOrder,
      appOrdersCount: result.benefits.appOrdersCount,
      eligibleDiscounts: result.benefits.eligibleDiscounts,
    });

    if (options?.applyDiscount === false) {
      if (!result.benefits.isFirstAppOrder) {
        void import('@/services/cart/auto-first-app-order-discount')
          .then((mod) => {
            mod.noteFirstAppOrderDiscountIneligible();
          })
          .catch(() => {});
      }
      return;
    }

    void import('@/services/cart/auto-first-app-order-discount')
      .then((mod) => {
        if (result.benefits.isFirstAppOrder) {
          mod.maybeAutoApplyFirstAppOrderDiscount();
        } else {
          mod.noteFirstAppOrderDiscountIneligible();
        }
      })
      .catch(() => {});
  },

  clear: () => {
    invalidateAppBenefitsCache();
    set({
      isFirstAppOrder: null,
      appOrdersCount: null,
      eligibleDiscounts: [],
    });
  },
}));

/** Fire-and-forget refresh after login or session restore. */
export function refreshAppBenefitsInBackground(
  sessionToken?: string | null,
  options?: { force?: boolean; applyDiscount?: boolean },
): void {
  void useAppBenefitsStore.getState().refresh(sessionToken, options);
}

/** Debounced refresh when cart lines change — avoids hammering the API. */
export function scheduleAppBenefitsRefreshOnCartChange(sessionToken?: string | null): void {
  if (useAppBenefitsStore.getState().isFirstAppOrder === null) {
    logAppBenefits({ action: 'refresh_immediate', reason: 'first_order_unknown' });
    refreshAppBenefitsInBackground(sessionToken);
    return;
  }

  if (cartRefreshTimer) {
    clearTimeout(cartRefreshTimer);
  }
  cartRefreshTimer = setTimeout(() => {
    cartRefreshTimer = null;
    refreshAppBenefitsInBackground(sessionToken);
  }, CART_REFRESH_DEBOUNCE_MS);
}

/** True when the customer has never completed an app order; null until loaded. */
export function getIsFirstAppOrderSync(): boolean | null {
  return useAppBenefitsStore.getState().isFirstAppOrder;
}
