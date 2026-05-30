import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';
import { getShopifyCurrencyCode } from '@/services/shopify/market-context';

import { lineSubtotalMoney } from '@/utils/cart-line-pricing';

/** Subtotal before shipping — sum of each line’s subtotal (same basis as row totals). */
export function computeCartSubtotal(lines: CartLine[], fallbackCurrency?: string): Money {
  let sum = 0;
  let currencyCode = fallbackCurrency?.trim().toUpperCase() || getShopifyCurrencyCode();
  for (const line of lines) {
    const sub = lineSubtotalMoney(line);
    if (!sub) continue;
    currencyCode = sub.currencyCode;
    sum += Number.parseFloat(sub.amount);
  }
  return { amount: sum.toFixed(2), currencyCode };
}

/** Default when CMS `delivery_threshold` is unavailable (see `useDeliveryThreshold`). */
export const FREE_SHIPPING_THRESHOLD_AMOUNT = 100;
const FLAT_SHIPPING_AMOUNT = '3.99';

/** Simple policy: complimentary over threshold, otherwise flat rate */
export function computeShippingEstimate(
  subtotal: Money,
  freeDeliveryThresholdGbp: number = FREE_SHIPPING_THRESHOLD_AMOUNT,
): Money {
  const n = Number.parseFloat(subtotal.amount);
  const threshold =
    Number.isFinite(freeDeliveryThresholdGbp) && freeDeliveryThresholdGbp > 0
      ? freeDeliveryThresholdGbp
      : FREE_SHIPPING_THRESHOLD_AMOUNT;
  if (Number.isNaN(n) || n <= 0) {
    return { amount: '0', currencyCode: subtotal.currencyCode };
  }
  if (n >= threshold) {
    return { amount: '0', currencyCode: subtotal.currencyCode };
  }
  return { amount: FLAT_SHIPPING_AMOUNT, currencyCode: subtotal.currencyCode };
}

export function computeEstimatedTotal(subtotal: Money, shipping: Money): Money {
  const a = Number.parseFloat(subtotal.amount) + Number.parseFloat(shipping.amount);
  return { amount: a.toFixed(2), currencyCode: subtotal.currencyCode };
}
