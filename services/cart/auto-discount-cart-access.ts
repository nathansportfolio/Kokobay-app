import type { ShopifyCartSnapshot } from '@/services/shopify/cart';
import type { CartDiscountCode, CartLine } from '@/types/cart';

type AutoDiscountCartAccess = {
  readState: () => { lines: CartLine[]; shopifyDiscountCodes: CartDiscountCode[] };
  applySnapshot: (snapshot: ShopifyCartSnapshot) => void;
};

let access: AutoDiscountCartAccess | null = null;

export function registerAutoDiscountCartAccess(next: AutoDiscountCartAccess): void {
  access = next;
}

export function getAutoDiscountCartState(): {
  lines: CartLine[];
  shopifyDiscountCodes: CartDiscountCode[];
} {
  return access?.readState() ?? { lines: [], shopifyDiscountCodes: [] };
}

export function applyAutoDiscountCartSnapshot(snapshot: ShopifyCartSnapshot): void {
  access?.applySnapshot(snapshot);
}
