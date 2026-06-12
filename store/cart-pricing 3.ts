import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { getDeliveryThresholdGbpSync } from '@/src/core/query/delivery-threshold-query';
import type { CartDiscountCode } from '@/types/cart';
import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';
import {
  computeCartSubtotal,
  computeEstimatedTotal,
  computeShippingEstimate,
} from '@/utils/cart-totals';
import { hasCartLinePricing } from '@/utils/cart-line-pricing';
import {
  logCartAuditOptimisticUpdate,
  logCartAuditPricingSelector,
  type CartPricingAuditRevision,
} from '@/lib/cart-pricing-audit';

import {
  hasCartDiscountCodes,
  mergeCartDiscountCodes,
  pickDiscountAmount,
} from './cart-discounts';
import type { CartState, ReservedCartPricing } from './cart-types';

export type { ReservedCartPricing } from './cart-types';

export type CartPricingForDisplay = {
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  shopifyTotalTax: Money | null;
  shopifyDiscountCodes: CartDiscountCode[];
  shopifyCartDiscountAmount: Money | null;
  shopifyLineMerchandiseSubtotal: Money | null;
  shopifyLineMerchandiseTotal: Money | null;
};

export type CartPricingForDisplayState = Pick<
  CartState,
  | 'shopifySubtotal'
  | 'shopifyTotal'
  | 'shopifyTotalTax'
  | 'shopifyDiscountCodes'
  | 'shopifyCartDiscountAmount'
  | 'shopifyLineMerchandiseSubtotal'
  | 'shopifyLineMerchandiseTotal'
  | 'reservedDiscountPricing'
  | 'pendingCartSync'
  | 'isSyncingShopify'
  | 'quantitySyncPendingByVariantId'
>;

function hasQuantitySyncPending(pending: Record<string, true>): boolean {
  return Object.keys(pending).length > 0;
}

let cartPricingForDisplayCache: CartPricingForDisplay | null = null;

function moneyEqual(a: Money | null | undefined, b: Money | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.amount === b.amount && a.currencyCode === b.currencyCode;
}

function discountCodesEqual(a: CartDiscountCode[], b: CartDiscountCode[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left.code !== right.code || left.applicable !== right.applicable) return false;
    if (!moneyEqual(left.amount, right.amount)) return false;
  }
  return true;
}

function cartPricingForDisplayEqual(a: CartPricingForDisplay, b: CartPricingForDisplay): boolean {
  return (
    moneyEqual(a.shopifySubtotal, b.shopifySubtotal) &&
    moneyEqual(a.shopifyTotal, b.shopifyTotal) &&
    moneyEqual(a.shopifyTotalTax, b.shopifyTotalTax) &&
    discountCodesEqual(a.shopifyDiscountCodes, b.shopifyDiscountCodes) &&
    moneyEqual(a.shopifyCartDiscountAmount, b.shopifyCartDiscountAmount) &&
    moneyEqual(a.shopifyLineMerchandiseSubtotal, b.shopifyLineMerchandiseSubtotal) &&
    moneyEqual(a.shopifyLineMerchandiseTotal, b.shopifyLineMerchandiseTotal)
  );
}

/** Keep last API discount pricing visible while cart sync is in flight. */
function computeCartPricingForDisplay(
  state: CartPricingForDisplayState,
): { pricing: CartPricingForDisplay; selectorPath: 'reserved_during_sync' | 'live_state' } {
  const qtySyncPending = hasQuantitySyncPending(state.quantitySyncPendingByVariantId);
  if (
    (state.pendingCartSync || state.isSyncingShopify) &&
    state.reservedDiscountPricing &&
    !qtySyncPending
  ) {
    const reserved = state.reservedDiscountPricing;
    return {
      selectorPath: 'reserved_during_sync',
      pricing: {
        ...reserved,
        shopifyDiscountCodes: mergeCartDiscountCodes(
          state.shopifyDiscountCodes,
          reserved.shopifyDiscountCodes,
        ),
        shopifyCartDiscountAmount:
          pickDiscountAmount(state.shopifyCartDiscountAmount, reserved.shopifyCartDiscountAmount) ??
          state.shopifyCartDiscountAmount ??
          reserved.shopifyCartDiscountAmount ??
          null,
      },
    };
  }
  return {
    selectorPath: 'live_state',
    pricing: {
      shopifySubtotal: state.shopifySubtotal,
      shopifyTotal: state.shopifyTotal,
      shopifyTotalTax: state.shopifyTotalTax,
      shopifyDiscountCodes: state.shopifyDiscountCodes,
      shopifyCartDiscountAmount: state.shopifyCartDiscountAmount,
      shopifyLineMerchandiseSubtotal: state.shopifyLineMerchandiseSubtotal,
      shopifyLineMerchandiseTotal: state.shopifyLineMerchandiseTotal,
    },
  };
}

let lastCartPricingSelectorAuditKey = '';

function auditCartPricingSelector(
  state: CartPricingForDisplayState,
  next: CartPricingForDisplay,
  selectorPath: 'reserved_during_sync' | 'live_state',
  getRevision: () => CartPricingAuditRevision,
): void {
  if (!__DEV__) return;
  const auditKey = [
    selectorPath,
    state.pendingCartSync,
    state.isSyncingShopify,
    state.shopifySubtotal?.amount,
    state.shopifyTotal?.amount,
    state.reservedDiscountPricing?.shopifySubtotal?.amount,
    next.shopifySubtotal?.amount,
    next.shopifyTotal?.amount,
  ].join('|');
  if (auditKey === lastCartPricingSelectorAuditKey) return;
  lastCartPricingSelectorAuditKey = auditKey;

  logCartAuditPricingSelector({
    revision: getRevision(),
    pendingCartSync: state.pendingCartSync,
    isSyncingShopify: state.isSyncingShopify,
    hasReservedDiscountPricing: Boolean(state.reservedDiscountPricing),
    raw: {
      shopifySubtotal: state.shopifySubtotal,
      shopifyTotal: state.shopifyTotal,
      shopifyTotalTax: state.shopifyTotalTax,
      shopifyLineMerchandiseSubtotal: state.shopifyLineMerchandiseSubtotal,
      shopifyLineMerchandiseTotal: state.shopifyLineMerchandiseTotal,
    },
    reserved: state.reservedDiscountPricing
      ? {
          shopifySubtotal: state.reservedDiscountPricing.shopifySubtotal,
          shopifyTotal: state.reservedDiscountPricing.shopifyTotal,
        }
      : null,
    output: next,
    selectorPath,
  });
}

const lineQuantityPricePendingSelectorCache = new Map<
  string,
  (state: Pick<CartState, 'quantitySyncPendingByVariantId'>) => boolean
>();

export function selectIsLineQuantityPricePending(variantId: string) {
  const key = variantId.trim();
  if (!key) {
    return (state: Pick<CartState, 'quantitySyncPendingByVariantId'>) => false;
  }
  let selector = lineQuantityPricePendingSelectorCache.get(key);
  if (!selector) {
    selector = (state) => Boolean(state.quantitySyncPendingByVariantId[key]);
    lineQuantityPricePendingSelectorCache.set(key, selector);
  }
  return selector;
}

/** True while a qty change is awaiting confirmed line/checkout pricing (not login cart merge). */
export function selectIsCartCheckoutPricingPending(
  state: Pick<CartState, 'quantitySyncPendingByVariantId'>,
): boolean {
  return Object.keys(state.quantitySyncPendingByVariantId).length > 0;
}

let pricingRevisionGetter: (() => CartPricingAuditRevision) | null = null;

export function bindCartPricingRevision(getter: () => CartPricingAuditRevision): void {
  pricingRevisionGetter = getter;
}

export function selectCartPricingForDisplay(state: CartPricingForDisplayState): CartPricingForDisplay {
  const { pricing: next, selectorPath } = computeCartPricingForDisplay(state);
  if (cartPricingForDisplayCache && cartPricingForDisplayEqual(cartPricingForDisplayCache, next)) {
    return cartPricingForDisplayCache;
  }
  if (pricingRevisionGetter) {
    auditCartPricingSelector(state, next, selectorPath, pricingRevisionGetter);
  }
  cartPricingForDisplayCache = next;
  return next;
}

export function resetCartPricingCacheForTests(): void {
  cartPricingForDisplayCache = null;
  lastCartPricingSelectorAuditKey = '';
}

/**
 * Keep footer subtotal in sync with qty changes before Shopify sync returns.
 * For remote Shopify carts, do not add the local £3.99 estimate to `shopifyTotal` —
 * that made delivery flicker to £3.99 until GET /api/cart completed.
 */
export function optimisticCartTotals(lines: CartLine[]): {
  shopifySubtotal: Money;
  shopifyTotal: Money;
} | null {
  if (!hasCartLinePricing(lines)) return null;
  const shopifySubtotal = computeCartSubtotal(lines);
  if (isRemoteCartConfigured()) {
    return { shopifySubtotal, shopifyTotal: shopifySubtotal };
  }
  const shipping = computeShippingEstimate(shopifySubtotal, getDeliveryThresholdGbpSync());
  return {
    shopifySubtotal,
    shopifyTotal: computeEstimatedTotal(shopifySubtotal, shipping),
  };
}

export function checkoutUrlsFromValue(checkoutUrl: string | null | undefined): {
  checkoutUrl: string | null;
  storeCheckoutUrl: string | null;
} {
  const normalized = checkoutUrl?.trim() || null;
  return { checkoutUrl: normalized, storeCheckoutUrl: normalized };
}

export function clearCartPricingFields(): Pick<
  CartState,
  | 'shopifySubtotal'
  | 'shopifyTotal'
  | 'shopifyTotalTax'
  | 'shopifyLineMerchandiseSubtotal'
  | 'shopifyLineMerchandiseTotal'
> {
  return {
    shopifySubtotal: null,
    shopifyTotal: null,
    shopifyTotalTax: null,
    shopifyLineMerchandiseSubtotal: null,
    shopifyLineMerchandiseTotal: null,
  };
}

export function applyOptimisticLineUpdate(
  lines: CartLine[],
  previous: Pick<
    CartState,
    | 'shopifySubtotal'
    | 'shopifyTotal'
    | 'shopifyTotalTax'
    | 'shopifyDiscountCodes'
    | 'quantitySyncPendingByVariantId'
  >,
  options?: { quantitySyncVariantId?: string; markQuantitySyncPending?: (pending: Record<string, true>, variantId: string) => Record<string, true> },
): Partial<CartState> {
  const quantitySyncPendingByVariantId =
    options?.quantitySyncVariantId && options.markQuantitySyncPending
      ? options.markQuantitySyncPending(
          previous.quantitySyncPendingByVariantId,
          options.quantitySyncVariantId,
        )
      : previous.quantitySyncPendingByVariantId;

  const totals = optimisticCartTotals(lines);
  if (!totals) {
    return options?.quantitySyncVariantId ? { lines, quantitySyncPendingByVariantId } : { lines };
  }

  if (__DEV__ && pricingRevisionGetter) {
    logCartAuditOptimisticUpdate({
      revision: pricingRevisionGetter(),
      variantId: options?.quantitySyncVariantId,
      optimisticSubtotal: totals.shopifySubtotal,
      optimisticTotal: hasCartDiscountCodes(previous.shopifyDiscountCodes)
        ? null
        : totals.shopifyTotal,
      hasDiscountCodes: hasCartDiscountCodes(previous.shopifyDiscountCodes),
      previousSubtotal: previous.shopifySubtotal,
      previousTotal: previous.shopifyTotal,
    });
  }

  if (hasCartDiscountCodes(previous.shopifyDiscountCodes)) {
    return {
      lines,
      shopifySubtotal: totals.shopifySubtotal,
      quantitySyncPendingByVariantId,
    };
  }

  return {
    lines,
    shopifySubtotal: totals.shopifySubtotal,
    shopifyTotal: totals.shopifyTotal,
    shopifyTotalTax: previous.shopifyTotalTax,
    quantitySyncPendingByVariantId,
  };
}
