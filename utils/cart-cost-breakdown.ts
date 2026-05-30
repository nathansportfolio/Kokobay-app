import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';

import { hasCartLinePricing } from '@/utils/cart-line-pricing';
import { computeCartSubtotal, computeShippingEstimate } from '@/utils/cart-totals';

export type CartCostBreakdown = {
  subtotal: Money;
  delivery: Money | null;
  tax: Money | null;
  total: Money;
};

function parseAmount(m: Money): number {
  return Number.parseFloat(m.amount);
}

function money(amount: number, currencyCode: string): Money {
  return { amount: amount.toFixed(2), currencyCode };
}

/**
 * Derive delivery (and optional tax) from Shopify cart cost fields.
 * delivery ≈ total − subtotal − tax when Shopify does not expose shipping on the cart.
 */
export function deriveCartCostBreakdown(
  subtotal: Money,
  total: Money,
  totalTax?: Money | null,
): CartCostBreakdown {
  const sub = parseAmount(subtotal);
  const tot = parseAmount(total);
  const taxN = totalTax ? parseAmount(totalTax) : 0;
  const currencyCode = total.currencyCode || subtotal.currencyCode;

  const tax =
    totalTax && Number.isFinite(taxN) && taxN > 0.005
      ? { amount: totalTax.amount, currencyCode: totalTax.currencyCode }
      : null;

  if (!Number.isFinite(sub) || !Number.isFinite(tot) || tot < sub - 0.005) {
    return { subtotal, delivery: null, tax, total };
  }

  const deliveryN = tot - sub - (tax ? taxN : 0);
  if (deliveryN > 0.005) {
    return {
      subtotal,
      delivery: money(deliveryN, currencyCode),
      tax,
      total,
    };
  }

  return {
    subtotal,
    delivery: null,
    tax,
    total,
  };
}

/** Local bag estimate before / between Shopify syncs. */
export function estimateCartCostBreakdown(
  subtotal: Money,
  freeDeliveryThresholdGbp?: number,
): CartCostBreakdown {
  const delivery = computeShippingEstimate(subtotal, freeDeliveryThresholdGbp);
  const deliveryN = parseAmount(delivery);
  const sub = parseAmount(subtotal);
  return {
    subtotal,
    delivery,
    tax: null,
    total: money(sub + deliveryN, subtotal.currencyCode),
  };
}

function currenciesMatch(a?: string | null, b?: string | null): boolean {
  const left = a?.trim().toUpperCase();
  const right = b?.trim().toUpperCase();
  return Boolean(left && right && left === right);
}

/** Prefer Shopify totals only when they match the shopper market and visible line prices. */
export function resolveCartCostBreakdownForDisplay(options: {
  lines: CartLine[];
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  shopifyTotalTax: Money | null;
  usesShopifyCheckout: boolean;
  marketCurrency: string;
  /** CMS `delivery_threshold` for local shipping estimate (default 100). */
  freeDeliveryThresholdGbp?: number;
}): CartCostBreakdown {
  const localSubtotal = computeCartSubtotal(options.lines, options.marketCurrency);
  const hasLocalPricing = hasCartLinePricing(options.lines);
  const shopifySubtotal = options.shopifySubtotal;
  const shopifyMatchesMarket = currenciesMatch(shopifySubtotal?.currencyCode, options.marketCurrency);
  const shopifyMatchesLines =
    !hasLocalPricing ||
    currenciesMatch(shopifySubtotal?.currencyCode, localSubtotal.currencyCode);
  const useShopifyTotals =
    options.usesShopifyCheckout &&
    Boolean(shopifySubtotal) &&
    shopifyMatchesMarket &&
    shopifyMatchesLines;

  if (useShopifyTotals && shopifySubtotal && options.shopifyTotal) {
    return deriveCartCostBreakdown(shopifySubtotal, options.shopifyTotal, options.shopifyTotalTax);
  }

  const subtotal = hasLocalPricing ? localSubtotal : shopifySubtotal ?? localSubtotal;
  if (options.usesShopifyCheckout) {
    return {
      subtotal,
      delivery: null,
      tax: null,
      total: subtotal,
    };
  }
  return estimateCartCostBreakdown(subtotal, options.freeDeliveryThresholdGbp);
}
