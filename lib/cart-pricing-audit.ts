/**
 * Dev-only cart pricing audit — filter Metro with `[CART AUDIT]`.
 * Surfaces mismatches between line-level local math and summary API totals.
 */

import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';
import type { ShopifyCartSnapshot } from '@/services/shopify/cart';

import { computeCartSubtotal, computeCartListSubtotal } from '@/utils/cart-totals';
import { lineSubtotalMoney, resolveCartLineUnitPrice } from '@/utils/cart-line-pricing';

export type CartPricingAuditRevision = {
  cartRevision: number;
  lastSyncedRevision: number;
  isCartDirty: boolean;
};

export type CartPricingAuditZustand = {
  revision: CartPricingAuditRevision;
  lineCount: number;
  lines: Array<{
    variantId: string;
    handle: string;
    qty: number;
    unitPrice: string | null;
    listUnitPrice: string | null;
    lineTotal: string | null;
    shopifyLineId: string | null;
  }>;
  localSubtotal: string | null;
  localListSubtotal: string | null;
  shopifySubtotal: string | null;
  shopifyTotal: string | null;
  shopifyTotalTax: string | null;
  shopifyLineMerchandiseSubtotal: string | null;
  shopifyLineMerchandiseTotal: string | null;
  shopifyCartDiscountAmount: string | null;
  shopifyDiscountCodes: string[];
  reservedDiscountPricing: {
    shopifySubtotal: string | null;
    shopifyTotal: string | null;
  } | null;
  pendingCartSync: boolean;
  isSyncingShopify: boolean;
  displayAppliedDiscounts: Array<{ code: string; amount: string }>;
};

function moneyLabel(m: Money | null | undefined): string | null {
  if (!m?.amount) return null;
  return `${m.currencyCode} ${m.amount}`;
}

function logCartAudit(detail: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log('[CART AUDIT]', detail);
}

function linesAuditPayload(lines: CartLine[]) {
  return lines.map((line) => {
    const unit = resolveCartLineUnitPrice(line);
    const lineTotal = lineSubtotalMoney(line);
    return {
      variantId: line.variantId,
      handle: line.handle,
      qty: line.qty,
      unitPrice: moneyLabel(unit),
      listUnitPrice: moneyLabel(line.listUnitPrice ?? line.unitPrice ?? null),
      lineTotal: moneyLabel(lineTotal),
      shopifyLineId: line.shopifyLineId ?? null,
    };
  });
}

export function logCartAuditLineItem(line: CartLine): void {
  const unit = resolveCartLineUnitPrice(line);
  const lineTotal = lineSubtotalMoney(line);
  logCartAudit({
    source: 'line_item',
    variantId: line.variantId,
    qty: line.qty,
    unitPrice: moneyLabel(unit),
    listUnitPrice: moneyLabel(line.listUnitPrice ?? line.unitPrice ?? null),
    lineTotal: moneyLabel(lineTotal),
    shopifyLineId: line.shopifyLineId ?? null,
    pricingSource: 'local_zustand_line',
  });
}

export function logCartAuditZustandState(payload: CartPricingAuditZustand): void {
  logCartAudit({
    source: 'zustand_cart_state',
    ...payload,
  });
}

export function logCartAuditShopifyCart(
  snapshot: ShopifyCartSnapshot,
  meta: {
    origin: 'kokobay_api' | 'shopify_graphql' | 'apply_remote_snapshot';
    lines: CartLine[];
  },
): void {
  logCartAudit({
    source: 'shopify_cart',
    origin: meta.origin,
    cartId: snapshot.cartId,
    subtotal: moneyLabel(snapshot.subtotal),
    total: moneyLabel(snapshot.total),
    totalTax: moneyLabel(snapshot.totalTax ?? null),
    lineMerchandiseSubtotal: moneyLabel(snapshot.lineMerchandiseSubtotal ?? null),
    lineMerchandiseTotal: moneyLabel(snapshot.lineMerchandiseTotal ?? null),
    cartDiscountAmount: moneyLabel(snapshot.cartDiscountAmount ?? null),
    discountCodes: (snapshot.discountCodes ?? []).map((c) => c.code),
    remoteLines: snapshot.lines.map((l) => ({
      variantId: l.variantId,
      qty: l.qty,
      unitPrice: moneyLabel(l.unitPrice ?? null),
      shopifyLineId: l.shopifyLineId ?? null,
    })),
    localLinesAtApply: linesAuditPayload(meta.lines),
  });
}

export function logCartAuditPricingSelector(input: {
  revision: CartPricingAuditRevision;
  pendingCartSync: boolean;
  isSyncingShopify: boolean;
  hasReservedDiscountPricing: boolean;
  raw: {
    shopifySubtotal: Money | null;
    shopifyTotal: Money | null;
    shopifyTotalTax: Money | null;
    shopifyLineMerchandiseSubtotal: Money | null;
    shopifyLineMerchandiseTotal: Money | null;
  };
  reserved: {
    shopifySubtotal: Money | null;
    shopifyTotal: Money | null;
  } | null;
  output: {
    shopifySubtotal: Money | null;
    shopifyTotal: Money | null;
    shopifyTotalTax: Money | null;
    shopifyLineMerchandiseSubtotal: Money | null;
    shopifyLineMerchandiseTotal: Money | null;
  };
  selectorPath: 'reserved_during_sync' | 'live_state';
}): void {
  logCartAudit({
    source: 'pricing_selector',
    selectorPath: input.selectorPath,
    ...input.revision,
    pendingCartSync: input.pendingCartSync,
    isSyncingShopify: input.isSyncingShopify,
    hasReservedDiscountPricing: input.hasReservedDiscountPricing,
    rawShopifySubtotal: moneyLabel(input.raw.shopifySubtotal),
    rawShopifyTotal: moneyLabel(input.raw.shopifyTotal),
    rawShopifyTotalTax: moneyLabel(input.raw.shopifyTotalTax),
    rawLineMerchandiseSubtotal: moneyLabel(input.raw.shopifyLineMerchandiseSubtotal),
    rawLineMerchandiseTotal: moneyLabel(input.raw.shopifyLineMerchandiseTotal),
    reservedSubtotal: moneyLabel(input.reserved?.shopifySubtotal ?? null),
    reservedTotal: moneyLabel(input.reserved?.shopifyTotal ?? null),
    outputShopifySubtotal: moneyLabel(input.output.shopifySubtotal),
    outputShopifyTotal: moneyLabel(input.output.shopifyTotal),
    outputShopifyTotalTax: moneyLabel(input.output.shopifyTotalTax),
    outputLineMerchandiseSubtotal: moneyLabel(input.output.shopifyLineMerchandiseSubtotal),
    outputLineMerchandiseTotal: moneyLabel(input.output.shopifyLineMerchandiseTotal),
  });
}

export function logCartAuditCostBreakdown(input: {
  revision: CartPricingAuditRevision;
  path: 'shopify_api_totals' | 'local_line_sum' | 'local_fallback' | 'estimate_shipping';
  localSubtotal: Money;
  hasLocalLinePricing: boolean;
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  usesShopifyCheckout: boolean;
  result: {
    subtotal: Money;
    total: Money;
    appliedDiscountCount: number;
    delivery: Money | null;
    tax: Money | null;
  };
}): void {
  logCartAudit({
    source: 'cost_breakdown',
    breakdownPath: input.path,
    ...input.revision,
    localSubtotal: moneyLabel(input.localSubtotal),
    hasLocalLinePricing: input.hasLocalLinePricing,
    rawShopifySubtotal: moneyLabel(input.shopifySubtotal),
    rawShopifyTotal: moneyLabel(input.shopifyTotal),
    usesShopifyCheckout: input.usesShopifyCheckout,
    calculatedSubtotal: moneyLabel(input.result.subtotal),
    calculatedTotal: moneyLabel(input.result.total),
    appliedDiscountCount: input.result.appliedDiscountCount,
    delivery: moneyLabel(input.result.delivery),
    tax: moneyLabel(input.result.tax),
  });
}

export function logCartAuditCartScreen(input: {
  revision: CartPricingAuditRevision;
  itemCount: number;
  quantities: number[];
  lineTotals: Array<string | null>;
  localSubtotal: Money;
  costBreakdownSubtotal: Money;
  costBreakdownTotal: Money;
}): void {
  const localSum = Number.parseFloat(input.localSubtotal.amount);
  const summarySub = Number.parseFloat(input.costBreakdownSubtotal.amount);
  const mismatch =
    Number.isFinite(localSum) &&
    Number.isFinite(summarySub) &&
    Math.abs(localSum - summarySub) > 0.02;

  logCartAudit({
    source: 'cart_screen',
    ...input.revision,
    itemCount: input.itemCount,
    quantities: input.quantities,
    lineTotals: input.lineTotals,
    localSubtotal: moneyLabel(input.localSubtotal),
    costBreakdownSubtotal: moneyLabel(input.costBreakdownSubtotal),
    costBreakdownTotal: moneyLabel(input.costBreakdownTotal),
    localVsSummaryDelta:
      mismatch ? (summarySub - localSum).toFixed(2) : '0.00',
    pricingMismatch: mismatch,
  });
}

export function logCartAuditCartSummary(input: {
  revision: CartPricingAuditRevision;
  lineCount?: number;
  rawSubtotalSource: string;
  rawShopifySubtotal: Money | null;
  rawShopifyTotal: Money | null;
  rawLineMerchandiseSubtotal: Money | null;
  rawLineMerchandiseTotal: Money | null;
  calculatedSubtotal: Money;
  calculatedTotal: Money;
  discountedSubtotal: Money | null;
  appliedDiscounts: Array<{ code: string; amount: string }>;
  freeDeliveryThresholdGbp: number;
  deliveryProgressSubtotal: Money;
  deliveryProgressPercent: number;
}): void {
  logCartAudit({
    source: 'cart_summary',
    ...input.revision,
    lineCount: input.lineCount ?? null,
    subtotal: moneyLabel(input.calculatedSubtotal),
    rawSubtotalSource: input.rawSubtotalSource,
    rawShopifySubtotal: moneyLabel(input.rawShopifySubtotal),
    rawShopifyTotal: moneyLabel(input.rawShopifyTotal),
    rawLineMerchandiseSubtotal: moneyLabel(input.rawLineMerchandiseSubtotal),
    rawLineMerchandiseTotal: moneyLabel(input.rawLineMerchandiseTotal),
    calculatedSubtotal: moneyLabel(input.calculatedSubtotal),
    calculatedTotal: moneyLabel(input.calculatedTotal),
    discountedSubtotal: moneyLabel(input.discountedSubtotal),
    appliedDiscounts: input.appliedDiscounts,
    freeDeliveryThresholdGbp: input.freeDeliveryThresholdGbp,
    deliveryProgressSubtotal: moneyLabel(input.deliveryProgressSubtotal),
    deliveryProgressPercent: input.deliveryProgressPercent,
  });
}

export function logCartAuditOptimisticUpdate(input: {
  revision: CartPricingAuditRevision;
  variantId?: string;
  optimisticSubtotal: Money;
  optimisticTotal: Money | null;
  hasDiscountCodes: boolean;
  previousSubtotal: Money | null;
  previousTotal: Money | null;
}): void {
  logCartAudit({
    source: 'optimistic_line_update',
    ...input.revision,
    variantId: input.variantId ?? null,
    optimisticSubtotal: moneyLabel(input.optimisticSubtotal),
    optimisticTotal: moneyLabel(input.optimisticTotal),
    hasDiscountCodes: input.hasDiscountCodes,
    previousSubtotal: moneyLabel(input.previousSubtotal),
    previousTotal: moneyLabel(input.previousTotal),
  });
}

export function buildCartPricingAuditZustand(input: {
  revision: CartPricingAuditRevision;
  lines: CartLine[];
  marketCurrency: string;
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  shopifyTotalTax: Money | null;
  shopifyLineMerchandiseSubtotal: Money | null;
  shopifyLineMerchandiseTotal: Money | null;
  shopifyCartDiscountAmount: Money | null;
  shopifyDiscountCodes: CartDiscountCode[];
  reservedDiscountPricing: {
    shopifySubtotal: Money | null;
    shopifyTotal: Money | null;
  } | null;
  pendingCartSync: boolean;
  isSyncingShopify: boolean;
  displayAppliedDiscounts: Array<{ code: string; amount: Money }>;
}): CartPricingAuditZustand {
  const localSubtotal = computeCartSubtotal(input.lines, input.marketCurrency);
  const localListSubtotal = computeCartListSubtotal(input.lines, input.marketCurrency);
  return {
    revision: input.revision,
    lineCount: input.lines.length,
    lines: linesAuditPayload(input.lines),
    localSubtotal: moneyLabel(localSubtotal),
    localListSubtotal: moneyLabel(localListSubtotal),
    shopifySubtotal: moneyLabel(input.shopifySubtotal),
    shopifyTotal: moneyLabel(input.shopifyTotal),
    shopifyTotalTax: moneyLabel(input.shopifyTotalTax),
    shopifyLineMerchandiseSubtotal: moneyLabel(input.shopifyLineMerchandiseSubtotal),
    shopifyLineMerchandiseTotal: moneyLabel(input.shopifyLineMerchandiseTotal),
    shopifyCartDiscountAmount: moneyLabel(input.shopifyCartDiscountAmount),
    shopifyDiscountCodes: input.shopifyDiscountCodes.map((c) => c.code),
    reservedDiscountPricing: input.reservedDiscountPricing
      ? {
          shopifySubtotal: moneyLabel(input.reservedDiscountPricing.shopifySubtotal),
          shopifyTotal: moneyLabel(input.reservedDiscountPricing.shopifyTotal),
        }
      : null,
    pendingCartSync: input.pendingCartSync,
    isSyncingShopify: input.isSyncingShopify,
    displayAppliedDiscounts: input.displayAppliedDiscounts.map((d) => ({
      code: d.code,
      amount: moneyLabel(d.amount) ?? d.amount.amount,
    })),
  };
}
