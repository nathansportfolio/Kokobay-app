import { FIRST_APP_ORDER_DISCOUNT_CODE } from '@/constants/first-app-order-discount';
import { fetchCustomerAppBenefits } from '@/services/kokobay-web/app-benefits';
import { resolveCustomerSessionToken } from '@/services/kokobay-web/customer-session';
import { logAppFirstOrder } from '@/services/cart/app-first-order-log';

export type AppFirstOrderLogSnapshot = {
  isFirstAppOrder: boolean | null;
  appOrdersCount: number | null;
  eligibleDiscounts: unknown[];
  willAutoApplyTest: boolean;
};

const emptySnapshot = (): AppFirstOrderLogSnapshot => ({
  isFirstAppOrder: null,
  appOrdersCount: null,
  eligibleDiscounts: [],
  willAutoApplyTest: false,
});

/** Fetches benefits for logging only — does not touch Zustand (avoids require cycles). */
export async function resolveAppFirstOrderSnapshotForLog(): Promise<AppFirstOrderLogSnapshot> {
  const token = await resolveCustomerSessionToken();
  if (!token) {
    logAppFirstOrder('benefits_skip', { reason: 'no_session_token' });
    return emptySnapshot();
  }

  const result = await fetchCustomerAppBenefits(token);
  if (!result.ok) {
    return emptySnapshot();
  }

  const { isFirstAppOrder, appOrdersCount, eligibleDiscounts } = result.benefits;
  return {
    isFirstAppOrder,
    appOrdersCount,
    eligibleDiscounts,
    willAutoApplyTest: isFirstAppOrder === true,
  };
}

/** Call after `POST /api/cart` creates a new Shopify cart for this guest. */
export async function logAppFirstOrderOnNewCart(context: {
  guestId: string;
  customerEmail?: string;
  cartId?: string | null;
}): Promise<void> {
  const snap = await resolveAppFirstOrderSnapshotForLog();

  logAppFirstOrder('new_cart', {
    guestId: context.guestId.slice(0, 8),
    customerEmail: context.customerEmail?.trim() || null,
    cartId: context.cartId ?? null,
    autoDiscountCode: FIRST_APP_ORDER_DISCOUNT_CODE,
    ...snap,
  });
}
