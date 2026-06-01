import { FIRST_APP_ORDER_DISCOUNT_CODE } from '@/constants/first-app-order-discount';
import { logAppFirstOrder } from '@/services/cart/app-first-order-log';
import { isRemoteCartConfigured, usesKokobayCartProxy } from '@/services/cart/remote-cart';
import { getCartCustomerEmail } from '@/services/kokobay-web/cart-customer';
import { applyKokobayCartDiscountCode } from '@/services/kokobay-web/cart';
import { fetchCustomerAppBenefits } from '@/services/kokobay-web/app-benefits';
import { resolveCustomerSessionToken } from '@/services/kokobay-web/customer-session';
import { useAppBenefitsStore } from '@/store/app-benefits';
import { useCartStore } from '@/store/cart';
import { loadCartGuestId, persistCartGuestId } from '@/store/cart-persist';

import {
  clearFirstAppOrderDiscountApplySettled,
  isFirstAppOrderDiscountApplySettled,
  setFirstAppOrderDiscountApplySettled,
} from '@/services/cart/first-order-discount-settled';

const NON_RETRYABLE_DISCOUNT_CODES = new Set([
  'discount_not_applicable',
  'invalid_discount_code',
  'unauthorized',
]);

let autoApplyInFlight: Promise<void> | null = null;
/** Bumped on logout so in-flight discount applies cannot commit after session clear. */
let discountApplyGeneration = 0;

function logFirstAppOrderDiscount(payload: Record<string, unknown>): void {
  logAppFirstOrder('discount_flow', payload);
}

/** True when the cart already has any discount code (applicable or not). */
function cartHasAnyDiscountCodes(discountCodes: { code: string }[]): boolean {
  return discountCodes.some((entry) => entry.code.trim());
}

function benefitsSnapshot(): Record<string, unknown> {
  const { isFirstAppOrder, appOrdersCount, eligibleDiscounts } = useAppBenefitsStore.getState();
  return {
    isFirstAppOrder,
    appOrdersCount,
    eligibleDiscounts,
  };
}

function cartDiscountSnapshot(): Record<string, unknown> {
  const { lines, shopifyDiscountCodes } = useCartStore.getState();
  return {
    lineCount: lines.length,
    discountCodes: shopifyDiscountCodes.map((entry) => ({
      code: entry.code,
      applicable: entry.applicable,
    })),
  };
}

export function resetFirstAppOrderDiscountAutoApplyState(): void {
  discountApplyGeneration += 1;
  clearFirstAppOrderDiscountApplySettled();
  autoApplyInFlight = null;
  logFirstAppOrderDiscount({ action: 'reset_state' });
}

/**
 * Cart was cleared or remote cart has no discount codes — allow first-order code auto-apply again
 * for first-app-order customers (same session, new bag).
 */
export function allowFirstAppOrderDiscountAutoApplyRetry(): void {
  if (useAppBenefitsStore.getState().isFirstAppOrder === false) return;
  const { lines, shopifyDiscountCodes } = useCartStore.getState();
  if (cartHasAnyDiscountCodes(shopifyDiscountCodes)) return;
  if (!isFirstAppOrderDiscountApplySettled()) return;
  clearFirstAppOrderDiscountApplySettled();
  logFirstAppOrderDiscount({
    action: 'allow_retry',
    lineCount: lines.length,
    ...benefitsSnapshot(),
  });
}

export function noteFirstAppOrderDiscountIneligible(): void {
  setFirstAppOrderDiscountApplySettled(true);
  logFirstAppOrderDiscount({
    action: 'mark_ineligible',
    ...benefitsSnapshot(),
  });
}

type AutoApplySkipReason =
  | 'remote_cart_not_configured'
  | 'not_kokobay_proxy'
  | 'already_settled'
  | 'not_logged_in'
  | 'not_first_app_order'
  | 'first_order_unknown'
  | 'empty_cart'
  | 'has_discount_codes';

function getAutoApplySkipReason(): AutoApplySkipReason | null {
  if (!isRemoteCartConfigured()) return 'remote_cart_not_configured';
  if (!usesKokobayCartProxy()) return 'not_kokobay_proxy';
  if (!getCartCustomerEmail()) return 'not_logged_in';

  const isFirst = useAppBenefitsStore.getState().isFirstAppOrder;
  if (isFirst === false) return 'not_first_app_order';
  if (isFirst !== true) return 'first_order_unknown';

  const { lines, shopifyDiscountCodes } = useCartStore.getState();
  if (!lines.length) return 'empty_cart';
  if (cartHasAnyDiscountCodes(shopifyDiscountCodes)) return 'has_discount_codes';
  if (isFirstAppOrderDiscountApplySettled()) return 'already_settled';

  return null;
}

async function ensureFirstAppOrderEligibilityLoaded(): Promise<boolean | null> {
  const known = useAppBenefitsStore.getState().isFirstAppOrder;
  if (known !== null) {
    logFirstAppOrderDiscount({
      action: 'eligibility_cached',
      isFirstAppOrder: known,
      ...benefitsSnapshot(),
    });
    return known;
  }

  logFirstAppOrderDiscount({ action: 'eligibility_fetch_start' });

  const sessionToken = await resolveCustomerSessionToken();
  if (!sessionToken) {
    logFirstAppOrderDiscount({ action: 'eligibility_fetch_skip', reason: 'no_session_token' });
    return null;
  }

  const result = await fetchCustomerAppBenefits(token);
  if (result.ok) {
    useAppBenefitsStore.setState({
      isFirstAppOrder: result.benefits.isFirstAppOrder,
      appOrdersCount: result.benefits.appOrdersCount,
      eligibleDiscounts: result.benefits.eligibleDiscounts,
    });
  }
  const loaded = useAppBenefitsStore.getState().isFirstAppOrder;
  logFirstAppOrderDiscount({
    action: 'eligibility_fetch_done',
    isFirstAppOrder: loaded,
    ...benefitsSnapshot(),
  });
  return loaded;
}

/** Await an in-flight auto-apply (e.g. after login once cart + benefits are ready). */
export async function maybeAutoApplyFirstAppOrderDiscountAsync(
  customerEmail?: string,
): Promise<void> {
  if (autoApplyInFlight) {
    await autoApplyInFlight;
    return;
  }
  maybeAutoApplyFirstAppOrderDiscount(customerEmail);
  if (autoApplyInFlight) {
    await autoApplyInFlight;
  }
}

/** Logged-in first app order — silently apply first-order discount when the cart has no codes. */
export function maybeAutoApplyFirstAppOrderDiscount(customerEmail?: string): void {
  logFirstAppOrderDiscount({
    action: 'maybe_apply_triggered',
    customerEmail: customerEmail?.trim() || getCartCustomerEmail(),
    inFlight: Boolean(autoApplyInFlight),
    ...benefitsSnapshot(),
    ...cartDiscountSnapshot(),
  });

  if (autoApplyInFlight) {
    logFirstAppOrderDiscount({ action: 'maybe_apply_skip', reason: 'in_flight' });
    return;
  }

  autoApplyInFlight = runMaybeAutoApplyFirstAppOrderDiscount(customerEmail)
    .catch(() => {
      // Swallow — all paths return early; guard against unexpected throws from network/store.
    })
    .finally(() => {
      autoApplyInFlight = null;
    });
}

async function runMaybeAutoApplyFirstAppOrderDiscount(customerEmail?: string): Promise<void> {
  const eligibility = await ensureFirstAppOrderEligibilityLoaded();
  if (eligibility === false) {
    noteFirstAppOrderDiscountIneligible();
    logFirstAppOrderDiscount({
      action: 'skip',
      reason: 'not_first_app_order',
      ...benefitsSnapshot(),
    });
    return;
  }
  if (eligibility !== true) {
    logFirstAppOrderDiscount({
      action: 'skip',
      reason: 'first_order_unknown',
      ...benefitsSnapshot(),
    });
    return;
  }

  const skip = getAutoApplySkipReason();
  if (skip) {
    if (skip === 'has_discount_codes') {
      setFirstAppOrderDiscountApplySettled(true);
    }
    logFirstAppOrderDiscount({
      action: 'skip',
      reason: skip,
      ...benefitsSnapshot(),
      ...cartDiscountSnapshot(),
    });
    return;
  }

  await runAutoApplyFirstAppOrderDiscount(customerEmail);
}

async function runAutoApplyFirstAppOrderDiscount(customerEmail?: string): Promise<void> {
  const skip = getAutoApplySkipReason();
  if (skip) {
    logFirstAppOrderDiscount({ action: 'apply_abort', reason: skip });
    return;
  }

  const sessionToken = await resolveCustomerSessionToken();
  if (!sessionToken) {
    logFirstAppOrderDiscount({ action: 'apply_abort', reason: 'no_session_token' });
    return;
  }

  const email = customerEmail?.trim() || getCartCustomerEmail();
  if (!email) {
    logFirstAppOrderDiscount({ action: 'apply_abort', reason: 'no_email' });
    return;
  }

  const lines = useCartStore.getState().lines;
  if (!lines.length) {
    logFirstAppOrderDiscount({ action: 'apply_abort', reason: 'empty_cart' });
    return;
  }

  const applyGeneration = discountApplyGeneration;
  const guestId = await loadCartGuestId();
  logFirstAppOrderDiscount({
    action: 'apply_start',
    code: FIRST_APP_ORDER_DISCOUNT_CODE,
    guestId: guestId?.slice(0, 8),
    email,
    ...benefitsSnapshot(),
  });

  const result = await applyKokobayCartDiscountCode(
    guestId,
    FIRST_APP_ORDER_DISCOUNT_CODE,
    lines,
    email,
  );

  if (applyGeneration !== discountApplyGeneration) {
    logFirstAppOrderDiscount({ action: 'apply_abort', reason: 'session_reset' });
    return;
  }

  const skipAfterRequest = getAutoApplySkipReason();
  if (skipAfterRequest && skipAfterRequest !== 'already_settled') {
    logFirstAppOrderDiscount({ action: 'apply_abort', reason: skipAfterRequest });
    return;
  }

  if (result?.guestId) {
    await persistCartGuestId(result.guestId);
  }

  if (result?.syncError) {
    logFirstAppOrderDiscount({
      action: 'apply_failed',
      code: result.syncError.code,
      message: result.syncError.message,
    });
    if (NON_RETRYABLE_DISCOUNT_CODES.has(result.syncError.code)) {
      setFirstAppOrderDiscountApplySettled(true);
    }
    return;
  }

  if (!result?.snapshot) {
    logFirstAppOrderDiscount({ action: 'apply_failed', reason: 'no_snapshot' });
    return;
  }

  if (applyGeneration !== discountApplyGeneration) {
    logFirstAppOrderDiscount({ action: 'apply_abort', reason: 'session_reset' });
    return;
  }

  if (!useCartStore.getState().lines.length) {
    logFirstAppOrderDiscount({ action: 'apply_abort', reason: 'empty_cart' });
    return;
  }

  setFirstAppOrderDiscountApplySettled(true);
  useCartStore.getState().applyRemoteSnapshot(result.snapshot);
  logFirstAppOrderDiscount({
    action: 'apply_success',
    code: FIRST_APP_ORDER_DISCOUNT_CODE,
    discountCodes: result.snapshot.discountCodes?.map((entry) => ({
      code: entry.code,
      applicable: entry.applicable,
    })),
    subtotal: result.snapshot.subtotal?.amount,
    total: result.snapshot.total?.amount,
    discountAmount: result.snapshot.cartDiscountAmount?.amount,
  });
}
