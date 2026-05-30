import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';

/** Prefer snapshot from add-to-bag; older persisted lines without a price show no subtotal. */
export function resolveCartLineUnitPrice(line: CartLine): Money | null {
  if (line.unitPrice) {
    const n = Number.parseFloat(line.unitPrice.amount);
    if (Number.isFinite(n)) {
      return line.unitPrice;
    }
  }
  return null;
}

export function lineSubtotalMoney(line: CartLine): Money | null {
  const unit = resolveCartLineUnitPrice(line);
  if (!unit) return null;
  return {
    amount: (Number.parseFloat(unit.amount) * line.qty).toFixed(2),
    currencyCode: unit.currencyCode,
  };
}

export function hasCartLinePricing(lines: CartLine[]): boolean {
  return lines.some((line) => resolveCartLineUnitPrice(line) !== null);
}
