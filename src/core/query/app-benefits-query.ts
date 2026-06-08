import { getQueryClient } from '@/hooks/use-query-client';
import { logAppFirstOrder } from '@/services/cart/app-first-order-log';
import {
  fetchCustomerAppBenefits,
  type CustomerAppBenefits,
} from '@/services/kokobay-web/app-benefits';
import { resolveCustomerSessionToken } from '@/services/kokobay-web/customer-session';

import { accountQueryKeys } from './query-keys';

type AuthStoreState = {
  user: { id: string } | null;
};

type AuthStoreLike = {
  getState: () => AuthStoreState;
};

function getAuthStore(): AuthStoreLike {
  // Lazy require breaks auth-session ↔ cart-engine load cycle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/store/auth-session').useAuthStore as AuthStoreLike;
}

const APP_BENEFITS_STALE_MS = 60_000;
const CART_REFRESH_DEBOUNCE_MS = 2_000;

let cartRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function logAppBenefits(payload: Record<string, unknown>): void {
  logAppFirstOrder('benefits', payload);
}

function resolveBenefitsUserId(): string | null {
  return getAuthStore().getState().user?.id?.trim() || null;
}

function applyDiscountSideEffects(benefits: CustomerAppBenefits, applyDiscount: boolean): void {
  void import('@/services/cart/auto-first-app-order-discount')
    .then((mod) => {
      if (!applyDiscount) {
        if (!benefits.isFirstAppOrder) {
          mod.noteFirstAppOrderDiscountIneligible();
        }
        return;
      }
      if (benefits.isFirstAppOrder) {
        mod.maybeAutoApplyFirstAppOrderDiscount();
      } else {
        mod.noteFirstAppOrderDiscountIneligible();
      }
    })
    .catch(() => {});
}

/** React Query fetch for `GET /api/customer/app-benefits`. */
export async function fetchAppBenefitsQuery(
  sessionToken?: string | null,
  userId?: string | null,
  options?: { force?: boolean; applyDiscount?: boolean },
): Promise<CustomerAppBenefits | null> {
  const token = sessionToken?.trim() || (await resolveCustomerSessionToken());
  const resolvedUserId = userId?.trim() || resolveBenefitsUserId();
  if (!token || !resolvedUserId) {
    logAppBenefits({ action: 'refresh_skip', reason: 'no_session_token' });
    return null;
  }

  const queryClient = getQueryClient();
  const queryKey = accountQueryKeys.appBenefits(resolvedUserId);

  if (!options?.force) {
    const cached = queryClient.getQueryData<CustomerAppBenefits>(queryKey);
    if (cached) {
      if (options?.applyDiscount !== false) {
        applyDiscountSideEffects(cached, true);
      }
      return cached;
    }
  }

  const benefits = await queryClient.fetchQuery({
    queryKey,
    staleTime: options?.force ? 0 : APP_BENEFITS_STALE_MS,
    queryFn: async () => {
      const result = await fetchCustomerAppBenefits(token, { force: options?.force });
      if (!result.ok) {
        logAppBenefits({ action: 'refresh_failed', force: options?.force === true });
        return null;
      }

      logAppBenefits({
        action: 'refresh_ok',
        isFirstAppOrder: result.benefits.isFirstAppOrder,
        appOrdersCount: result.benefits.appOrdersCount,
        eligibleDiscounts: result.benefits.eligibleDiscounts,
      });

      return result.benefits;
    },
  });

  if (benefits) {
    applyDiscountSideEffects(benefits, options?.applyDiscount !== false);
  }

  return benefits;
}

export async function refreshAppBenefits(
  sessionToken?: string | null,
  options?: { force?: boolean; applyDiscount?: boolean },
): Promise<void> {
  await fetchAppBenefitsQuery(sessionToken, resolveBenefitsUserId(), options);
}

export function refreshAppBenefitsInBackground(
  sessionToken?: string | null,
  options?: { force?: boolean; applyDiscount?: boolean },
): void {
  void refreshAppBenefits(sessionToken, options);
}

export function cancelAppBenefitsBackgroundRefresh(): void {
  if (cartRefreshTimer) {
    clearTimeout(cartRefreshTimer);
    cartRefreshTimer = null;
  }
}

export function scheduleAppBenefitsRefreshOnCartChange(sessionToken?: string | null): void {
  const userId = resolveBenefitsUserId();
  const cached = userId ? getAppBenefitsSync(userId) : null;

  if (!cached) {
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

export function getAppBenefitsSync(userId?: string | null): CustomerAppBenefits | null {
  const resolvedUserId = userId?.trim() || resolveBenefitsUserId();
  if (!resolvedUserId) return null;
  return getQueryClient().getQueryData<CustomerAppBenefits>(
    accountQueryKeys.appBenefits(resolvedUserId),
  ) ?? null;
}

/** True when the customer has never completed an app order; null until loaded. */
export function getIsFirstAppOrderSync(): boolean | null {
  return getAppBenefitsSync()?.isFirstAppOrder ?? null;
}
