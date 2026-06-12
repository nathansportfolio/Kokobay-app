import { logAppFirstOrder } from '@/services/cart/app-first-order-log';
import {
  clearFirstAppOrderDiscountApplySettled,
  isFirstAppOrderDiscountApplySettled,
} from '@/services/cart/first-order-discount-settled';
import { getIsFirstAppOrderSync } from '@/src/core/query/app-benefits-query';
import type { CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';
import type { ShopifyCartSnapshot } from '@/services/shopify/cart';
import {
  deriveAppliedDiscountsFromCart,
  type CartAppliedDiscount,
} from '@/utils/cart-cost-breakdown';

import type { ReservedCartPricing } from './cart-types';

function cartDiscountAmountValue(amount: Money | null | undefined): number {
  if (amount?.amount == null || String(amount.amount).trim() === '') return 0;
  const value = Number.parseFloat(String(amount.amount));
  return Number.isFinite(value) ? value : 0;
}

export function pickDiscountAmount(
  primary: Money | null | undefined,
  secondary: Money | null | undefined,
): Money | undefined {
  const primaryN = cartDiscountAmountValue(primary);
  const secondaryN = cartDiscountAmountValue(secondary);
  if (primaryN <= 0.005 && secondaryN <= 0.005) return undefined;
  if (secondaryN > primaryN && secondary) return secondary;
  return primary ?? secondary ?? undefined;
}

export function mergeCartDiscountCodes(
  primary: CartDiscountCode[],
  secondary: CartDiscountCode[],
): CartDiscountCode[] {
  const byCode = new Map<string, CartDiscountCode>();
  for (const entry of [...secondary, ...primary]) {
    const key = entry.code.trim().toUpperCase();
    if (!key) continue;
    const prev = byCode.get(key);
    byCode.set(key, {
      code: entry.code,
      applicable: entry.applicable,
      amount: pickDiscountAmount(entry.amount, prev?.amount),
    });
  }
  return [...byCode.values()];
}

export function hasCartDiscountCodes(discountCodes: CartDiscountCode[]): boolean {
  return discountCodes.some((entry) => entry.code.trim());
}

export function emptyCartDiscountFields(): {
  shopifyDiscountCodes: CartDiscountCode[];
  shopifyCartDiscountAmount: null;
  reservedDiscountPricing: null;
  displayAppliedDiscounts: CartAppliedDiscount[];
} {
  return {
    shopifyDiscountCodes: [],
    shopifyCartDiscountAmount: null,
    reservedDiscountPricing: null,
    displayAppliedDiscounts: [],
  };
}

export function buildSnapshotDiscountState(snapshot: ShopifyCartSnapshot): {
  pricing: ReservedCartPricing;
  displayAppliedDiscounts: CartAppliedDiscount[];
  reservedDiscountPricing: ReservedCartPricing | null;
} {
  const discountCodes = snapshot.discountCodes ?? [];
  const pricing: ReservedCartPricing = {
    shopifySubtotal: snapshot.subtotal,
    shopifyTotal: snapshot.total,
    shopifyTotalTax: snapshot.totalTax ?? null,
    shopifyDiscountCodes: discountCodes,
    shopifyCartDiscountAmount: snapshot.cartDiscountAmount ?? null,
    shopifyLineMerchandiseSubtotal: snapshot.lineMerchandiseSubtotal ?? null,
    shopifyLineMerchandiseTotal: snapshot.lineMerchandiseTotal ?? null,
  };
  const displayAppliedDiscounts = deriveAppliedDiscountsFromCart({
    subtotal: snapshot.subtotal,
    total: snapshot.total,
    totalTax: snapshot.totalTax ?? null,
    discountCodes,
    cartDiscountAmount: snapshot.cartDiscountAmount ?? null,
    lineMerchandiseSubtotal: snapshot.lineMerchandiseSubtotal ?? null,
    lineMerchandiseTotal: snapshot.lineMerchandiseTotal ?? null,
  });
  return {
    pricing,
    displayAppliedDiscounts,
    reservedDiscountPricing: hasCartDiscountCodes(discountCodes) ? pricing : null,
  };
}

/** Empty bag or no codes on cart — first-order discount can be auto-applied again this session. */
export function notifyFirstAppOrderDiscountRetryAllowed(getState: () => {
  lines: { qty: number }[];
  shopifyDiscountCodes: CartDiscountCode[];
}): void {
  if (getIsFirstAppOrderSync() === false) return;
  const { lines, shopifyDiscountCodes } = getState();
  if (hasCartDiscountCodes(shopifyDiscountCodes)) return;
  if (!isFirstAppOrderDiscountApplySettled()) return;
  clearFirstAppOrderDiscountApplySettled();
  logAppFirstOrder('allow_retry', { lineCount: lines.length });
}
