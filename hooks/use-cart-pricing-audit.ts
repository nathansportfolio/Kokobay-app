import { useEffect, useRef } from 'react';

import {
  buildCartPricingAuditZustand,
  logCartAuditCartScreen,
  logCartAuditCartSummary,
  logCartAuditCostBreakdown,
  logCartAuditZustandState,
} from '@/lib/cart-pricing-audit';
import { getCartRevisionSnapshot, selectCartPricingForDisplay, useCartStore } from '@/store/cart';
import type { CartCostBreakdown } from '@/utils/cart-cost-breakdown';
import { hasCartLinePricing, lineSubtotalMoney } from '@/utils/cart-line-pricing';
import { computeCartSubtotal } from '@/utils/cart-totals';
import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';

function auditFingerprint(parts: unknown[]): string {
  return parts.map((p) => JSON.stringify(p)).join('|');
}

/** Dev-only: log cart screen vs summary pricing when values change. */
export function useCartPricingAuditScreen(options: {
  lines: CartLine[];
  marketCurrency: string;
  costBreakdown: CartCostBreakdown;
  freeDeliveryThresholdGbp: number;
  usesShopifyCheckout: boolean;
  bagUnitCount: number;
}): void {
  const fingerprintRef = useRef('');

  useEffect(() => {
    if (!__DEV__) return;

    const revision = getCartRevisionSnapshot();
    const localSubtotal = computeCartSubtotal(options.lines, options.marketCurrency);
    const lineTotals = options.lines.map((line) => {
      const m = lineSubtotalMoney(line);
      return m ? `${m.currencyCode} ${m.amount}` : null;
    });

    const fingerprint = auditFingerprint([
      revision,
      options.lines.map((l) => `${l.variantId}:${l.qty}:${l.unitPrice?.amount}`),
      localSubtotal.amount,
      options.costBreakdown.subtotal.amount,
      options.costBreakdown.total.amount,
    ]);
    if (fingerprint === fingerprintRef.current) return;
    fingerprintRef.current = fingerprint;

    const state = useCartStore.getState();
    const displayPricing = selectCartPricingForDisplay(state);
    const localSubtotalForPath = computeCartSubtotal(options.lines, options.marketCurrency);
    const hasLocalPricing = hasCartLinePricing(options.lines);
    const useShopifyTotals =
      options.usesShopifyCheckout &&
      Boolean(displayPricing.shopifySubtotal?.amount) &&
      Boolean(displayPricing.shopifyTotal?.amount);
    const breakdownPath =
      useShopifyTotals ? 'shopify_api_totals'
      : options.usesShopifyCheckout ?
        hasLocalPricing ? 'local_line_sum'
        : 'local_fallback'
      : 'estimate_shipping';

    logCartAuditCostBreakdown({
      revision,
      path: breakdownPath,
      localSubtotal: localSubtotalForPath,
      hasLocalLinePricing: hasLocalPricing,
      shopifySubtotal: displayPricing.shopifySubtotal,
      shopifyTotal: displayPricing.shopifyTotal,
      usesShopifyCheckout: options.usesShopifyCheckout,
      result: {
        subtotal: options.costBreakdown.subtotal,
        total: options.costBreakdown.total,
        appliedDiscountCount: options.costBreakdown.appliedDiscounts.length,
        delivery: options.costBreakdown.delivery,
        tax: options.costBreakdown.tax,
      },
    });

    logCartAuditZustandState(
      buildCartPricingAuditZustand({
        revision,
        lines: state.lines,
        marketCurrency: options.marketCurrency,
        shopifySubtotal: state.shopifySubtotal,
        shopifyTotal: state.shopifyTotal,
        shopifyTotalTax: state.shopifyTotalTax,
        shopifyLineMerchandiseSubtotal: state.shopifyLineMerchandiseSubtotal,
        shopifyLineMerchandiseTotal: state.shopifyLineMerchandiseTotal,
        shopifyCartDiscountAmount: state.shopifyCartDiscountAmount,
        shopifyDiscountCodes: state.shopifyDiscountCodes,
        reservedDiscountPricing: state.reservedDiscountPricing,
        pendingCartSync: state.pendingCartSync,
        isSyncingShopify: state.isSyncingShopify,
        displayAppliedDiscounts: state.displayAppliedDiscounts,
      }),
    );

    logCartAuditCartScreen({
      revision,
      itemCount: options.lines.length,
      quantities: options.lines.map((l) => l.qty),
      lineTotals,
      localSubtotal,
      costBreakdownSubtotal: options.costBreakdown.subtotal,
      costBreakdownTotal: options.costBreakdown.total,
    });

    const subtotalN = Number.parseFloat(options.costBreakdown.subtotal.amount);
    const threshold =
      options.freeDeliveryThresholdGbp > 0 ? options.freeDeliveryThresholdGbp : 100;
    const deliveryProgressPercent =
      Number.isFinite(subtotalN) && threshold > 0
        ? Math.min(100, Math.round((subtotalN / threshold) * 100))
        : 0;

    const rawSubtotalSource =
      options.usesShopifyCheckout &&
      state.shopifySubtotal?.amount &&
      options.costBreakdown.subtotal.amount === state.shopifySubtotal.amount
        ? 'display_selector_shopify_subtotal'
      : options.costBreakdown.subtotal.amount === localSubtotal.amount
        ? 'local_line_sum'
        : 'mixed_or_derived';

    logCartAuditCartSummary({
      revision,
      lineCount: options.lines.length,
      rawSubtotalSource,
      rawShopifySubtotal: state.shopifySubtotal,
      rawShopifyTotal: state.shopifyTotal,
      rawLineMerchandiseSubtotal: state.shopifyLineMerchandiseSubtotal,
      rawLineMerchandiseTotal: state.shopifyLineMerchandiseTotal,
      calculatedSubtotal: options.costBreakdown.subtotal,
      calculatedTotal: options.costBreakdown.total,
      discountedSubtotal:
        options.costBreakdown.appliedDiscounts.length > 0 ? options.costBreakdown.total : null,
      appliedDiscounts: options.costBreakdown.appliedDiscounts.map((d) => ({
        code: d.code,
        amount: d.amount.amount,
      })),
      freeDeliveryThresholdGbp: threshold,
      deliveryProgressSubtotal: options.costBreakdown.subtotal,
      deliveryProgressPercent,
    });
  }, [
    options.lines,
    options.marketCurrency,
    options.costBreakdown.subtotal.amount,
    options.costBreakdown.total.amount,
    options.costBreakdown.appliedDiscounts,
    options.freeDeliveryThresholdGbp,
    options.usesShopifyCheckout,
    options.bagUnitCount,
  ]);
}

/** Dev-only: log checkout bar props vs raw store totals. */
export function useCartPricingAuditCheckoutBar(options: {
  subtotal: Money;
  total: Money;
  appliedDiscountCount: number;
}): void {
  const fingerprintRef = useRef('');

  useEffect(() => {
    if (!__DEV__) return;
    const fingerprint = auditFingerprint([
      getCartRevisionSnapshot(),
      options.subtotal.amount,
      options.total.amount,
      options.appliedDiscountCount,
    ]);
    if (fingerprint === fingerprintRef.current) return;
    fingerprintRef.current = fingerprint;

    const state = useCartStore.getState();
    logCartAuditCartSummary({
      revision: getCartRevisionSnapshot(),
      lineCount: useCartStore.getState().lines.length,
      rawSubtotalSource: 'checkout_bar_props',
      rawShopifySubtotal: state.shopifySubtotal,
      rawShopifyTotal: state.shopifyTotal,
      rawLineMerchandiseSubtotal: state.shopifyLineMerchandiseSubtotal,
      rawLineMerchandiseTotal: state.shopifyLineMerchandiseTotal,
      calculatedSubtotal: options.subtotal,
      calculatedTotal: options.total,
      discountedSubtotal: options.appliedDiscountCount > 0 ? options.total : null,
      appliedDiscounts: state.displayAppliedDiscounts.map((d) => ({
        code: d.code,
        amount: d.amount.amount,
      })),
      freeDeliveryThresholdGbp: 0,
      deliveryProgressSubtotal: options.subtotal,
      deliveryProgressPercent: 0,
    });
  }, [
    options.subtotal.amount,
    options.total.amount,
    options.appliedDiscountCount,
  ]);
}
