import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';

import { hasCartLinePricing } from '@/utils/cart-line-pricing';
import { computeCartSubtotal, computeShippingEstimate } from '@/utils/cart-totals';

export type CartCostBreakdown = {
  subtotal: Money;
  appliedDiscounts: CartAppliedDiscount[];
  delivery: Money | null;
  tax: Money | null;
  total: Money;
};

export type CartAppliedDiscount = {
  code: string;
  amount: Money;
};

export type CartApiPricing = {
  subtotal: Money;
  total: Money;
  totalTax?: Money | null;
  discountCodes?: CartDiscountCode[];
  cartDiscountAmount?: Money | null;
  lineMerchandiseSubtotal?: Money | null;
  lineMerchandiseTotal?: Money | null;
};

function parseAmount(m: Money): number {
  return Number.parseFloat(m.amount);
}

function money(amount: number, currencyCode: string): Money {
  return { amount: amount.toFixed(2), currencyCode };
}

function discountCodesOnCart(discountCodes: CartDiscountCode[]): CartDiscountCode[] {
  return discountCodes.filter((entry) => entry.code.trim());
}

function sumDiscountCodeAmounts(codes: CartDiscountCode[]): number {
  let sum = 0;
  let found = false;
  for (const entry of codes) {
    if (!entry.amount?.amount) continue;
    const value = parseAmount(entry.amount);
    if (value > 0.005) {
      sum += value;
      found = true;
    }
  }
  return found ? sum : 0;
}

/**
 * Merchandise discount savings for bag summary — excludes shipping baked into cart `total`.
 * Prefers explicit API discount fields over subtotal − total (which mixes shipping in).
 */
function resolveCartDiscountSavings(pricing: CartApiPricing): number {
  const codes = discountCodesOnCart(pricing.discountCodes ?? []);
  if (!codes.length) return 0;

  const subtotalN = parseAmount(pricing.subtotal);
  const totalN = parseAmount(pricing.total);
  const taxN = pricing.totalTax ? parseAmount(pricing.totalTax) : 0;

  const apiDiscountN = pricing.cartDiscountAmount ? parseAmount(pricing.cartDiscountAmount) : 0;
  if (apiDiscountN > 0.005) {
    if (totalN >= subtotalN - 0.005) return 0;
    return apiDiscountN;
  }

  const codeSum = sumDiscountCodeAmounts(codes);
  if (codeSum > 0.005) {
    if (totalN >= subtotalN - 0.005) return 0;
    return codeSum;
  }

  if (totalN <= subtotalN + 0.005) {
    const savings = subtotalN - totalN - taxN;
    return Number.isFinite(savings) && savings > 0.005 ? savings : 0;
  }

  return 0;
}

/** Derive discount rows — amount must reconcile: subtotal − discount = total. */
export function deriveAppliedDiscountsFromCart(pricing: CartApiPricing): CartAppliedDiscount[] {
  const codes = discountCodesOnCart(pricing.discountCodes ?? []);
  if (!codes.length) return [];

  const discountN = resolveCartDiscountSavings(pricing);
  if (discountN <= 0.005) return [];

  const currencyCode = pricing.total.currencyCode || pricing.subtotal.currencyCode;
  const amount = money(discountN, currencyCode);

  if (codes.length === 1) {
    return [{ code: codes[0]!.code, amount }];
  }

  return [{ code: codes.map((entry) => entry.code).join(', '), amount }];
}

/** @deprecated Prefer deriveAppliedDiscountsFromCart — kept for tests. */
export function deriveAppliedDiscounts(
  subtotal: Money,
  total: Money,
  totalTax: Money | null | undefined,
  discountCodes: CartDiscountCode[],
): CartAppliedDiscount[] {
  return deriveAppliedDiscountsFromCart({
    subtotal,
    total,
    totalTax,
    discountCodes,
  });
}

/**
 * Derive delivery (and optional tax) from Shopify cart cost fields.
 * delivery ≈ total − subtotal − tax when Shopify does not expose shipping on the cart.
 */
export function deriveCartCostBreakdown(
  subtotal: Money,
  total: Money,
  totalTax?: Money | null,
  discountCodes: CartDiscountCode[] = [],
  _lineMerchandiseSubtotal?: Money | null,
  _lineMerchandiseTotal?: Money | null,
  cartDiscountAmount?: Money | null,
): CartCostBreakdown {
  const appliedDiscounts = deriveAppliedDiscountsFromCart({
    subtotal,
    total,
    totalTax,
    discountCodes,
    cartDiscountAmount,
  });

  const sub = parseAmount(subtotal);
  const tot = parseAmount(total);
  const taxN = totalTax ? parseAmount(totalTax) : 0;
  const currencyCode = total.currencyCode || subtotal.currencyCode;

  const tax =
    totalTax && Number.isFinite(taxN) && taxN > 0.005
      ? { amount: totalTax.amount, currencyCode: totalTax.currencyCode }
      : null;

  const discountN = appliedDiscounts.reduce(
    (sum, entry) => sum + parseAmount(entry.amount),
    0,
  );

  if (discountN > 0.005) {
    return {
      subtotal,
      appliedDiscounts,
      delivery: null,
      tax,
      total: money(Math.max(0, sub - discountN), currencyCode),
    };
  }

  if (!Number.isFinite(sub) || !Number.isFinite(tot) || tot < sub - 0.005) {
    return { subtotal, appliedDiscounts, delivery: null, tax, total };
  }

  const deliveryN = tot - sub - (tax ? taxN : 0);
  if (deliveryN > 0.005) {
    return {
      subtotal,
      appliedDiscounts,
      delivery: money(deliveryN, currencyCode),
      tax,
      total,
    };
  }

  return {
    subtotal,
    appliedDiscounts,
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
    appliedDiscounts: [],
    delivery,
    tax: null,
    total: money(sub + deliveryN, subtotal.currencyCode),
  };
}

/** Prefer cart API totals whenever remote checkout is active and cart cost is present. */
export function resolveCartCostBreakdownForDisplay(options: {
  lines: CartLine[];
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  shopifyTotalTax: Money | null;
  shopifyDiscountCodes?: CartDiscountCode[];
  shopifyLineMerchandiseSubtotal?: Money | null;
  shopifyLineMerchandiseTotal?: Money | null;
  shopifyCartDiscountAmount?: Money | null;
  usesShopifyCheckout: boolean;
  marketCurrency: string;
  /** CMS `delivery_threshold` for local shipping estimate (default 100). */
  freeDeliveryThresholdGbp?: number;
}): CartCostBreakdown {
  const localSubtotal = computeCartSubtotal(options.lines, options.marketCurrency);
  const hasLocalPricing = hasCartLinePricing(options.lines);
  const shopifySubtotal = options.shopifySubtotal;
  const shopifyTotal = options.shopifyTotal;
  const useShopifyTotals =
    options.usesShopifyCheckout &&
    Boolean(shopifySubtotal?.amount) &&
    Boolean(shopifyTotal?.amount);

  const localSubN = Number.parseFloat(localSubtotal.amount);
  const shopifySubN = shopifySubtotal ? Number.parseFloat(shopifySubtotal.amount) : NaN;
  const localShopifySubtotalMismatch =
    hasLocalPricing &&
    Number.isFinite(localSubN) &&
    Number.isFinite(shopifySubN) &&
    Math.abs(localSubN - shopifySubN) > 0.02;

  /** Prefer line sum when footer API subtotal is stale vs optimistic qty (no discounts). */
  const preferLocalLineSubtotal =
    localShopifySubtotalMismatch &&
    localSubN > shopifySubN &&
    !(options.shopifyDiscountCodes ?? []).some((entry) => entry.code.trim());

  if (useShopifyTotals && shopifySubtotal && shopifyTotal && !preferLocalLineSubtotal) {
    return deriveCartCostBreakdown(
      shopifySubtotal,
      shopifyTotal,
      options.shopifyTotalTax,
      options.shopifyDiscountCodes ?? [],
      options.shopifyLineMerchandiseSubtotal,
      options.shopifyLineMerchandiseTotal,
      options.shopifyCartDiscountAmount,
    );
  }

  const subtotal = hasLocalPricing ? localSubtotal : shopifySubtotal ?? localSubtotal;
  if (options.usesShopifyCheckout) {
    return {
      subtotal,
      appliedDiscounts: [],
      delivery: null,
      tax: null,
      total: subtotal,
    };
  }
  return estimateCartCostBreakdown(subtotal, options.freeDeliveryThresholdGbp);
}
