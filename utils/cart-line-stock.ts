import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';
import type { ShopifyCartSnapshot } from '@/services/shopify/cart';

import { lineSubtotalMoney, resolveCartLineUnitPrice } from '@/utils/cart-line-pricing';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

function hasDiscountCodesOnCart(discountCodes: CartDiscountCode[] | undefined): boolean {
  return (discountCodes ?? []).some((entry) => entry.code.trim().length > 0);
}

function parseMoneyAmount(m: Money | null | undefined): number | null {
  if (m?.amount == null || String(m.amount).trim() === '') return null;
  const value = Number.parseFloat(String(m.amount));
  return Number.isFinite(value) ? value : null;
}

/** User-facing copy when catalog or Shopify has capped this line. */
export function cartLineStockLabel(line: CartLine): string | null {
  if (line.maxQty == null || line.maxQty < 1) return null;
  if (line.qty < line.maxQty) return null;
  return line.maxQty === 1 ? 'Only 1 in stock' : `Only ${line.maxQty} in stock`;
}

/**
 * When the cart API subtotal is below what local qty × unit price implies (no discounts),
 * infer the purchasable quantity from server pricing and clamp the line.
 */
export function reconcileLinesWithSnapshotSubtotal(
  lines: CartLine[],
  snapshot: ShopifyCartSnapshot,
): { lines: CartLine[]; qtyReduced: { actual: number; requested: number } | null } {
  if (hasDiscountCodesOnCart(snapshot.discountCodes)) {
    return { lines, qtyReduced: null };
  }
  if (lines.length !== 1) return { lines, qtyReduced: null };

  const line = lines[0]!;
  const unit = resolveCartLineUnitPrice(line);
  const unitN = parseMoneyAmount(unit);
  const serverSubN = parseMoneyAmount(snapshot.subtotal);
  if (unitN == null || unitN <= 0 || serverSubN == null) {
    return { lines, qtyReduced: null };
  }

  const localMerchN = line.qty * unitN;
  if (localMerchN <= serverSubN + 0.02) {
    return { lines, qtyReduced: null };
  }

  const impliedQty = Math.max(1, Math.min(line.qty, Math.floor(serverSubN / unitN + 1e-9)));
  if (impliedQty >= line.qty) {
    return { lines, qtyReduced: null };
  }

  const maxQty =
    line.maxQty != null ? Math.min(line.maxQty, impliedQty) : impliedQty;

  return {
    lines: [{ ...line, qty: impliedQty, maxQty }],
    qtyReduced: { actual: impliedQty, requested: line.qty },
  };
}

/** Variant id when a single-line cart exceeds the synced server subtotal; otherwise null. */
export function singleLineOverServerSubtotalVariantId(
  lines: CartLine[],
  shopifySubtotal: Money | null,
  shopifyDiscountCodes: CartDiscountCode[],
): string | null {
  if (lines.length !== 1) return null;
  const line = lines[0]!;
  return isCartLineOverServerSubtotal(line, lines, shopifySubtotal, shopifyDiscountCodes)
    ? line.variantId
    : null;
}

/** True when synced server subtotal is materially below this line's local extension. */
export function isCartLineOverServerSubtotal(
  line: CartLine,
  lines: CartLine[],
  shopifySubtotal: Money | null,
  shopifyDiscountCodes: CartDiscountCode[],
): boolean {
  if (hasDiscountCodesOnCart(shopifyDiscountCodes)) return false;
  if (lines.length !== 1) return false;
  if (shopifyVariantKey(line.variantId) !== shopifyVariantKey(lines[0]!.variantId)) {
    return false;
  }

  const local = lineSubtotalMoney(line);
  const localN = parseMoneyAmount(local);
  const serverN = parseMoneyAmount(shopifySubtotal);
  if (localN == null || serverN == null) return false;
  return localN > serverN + 0.02;
}
