import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { AddToCartInput, CartPricingForDisplay, CartRecoveryResult } from '@/store/cart';

export type CartStatus = 'HYDRATING' | 'READY' | 'SYNCING' | 'ERROR';

/** Screen-facing cart snapshot — read-only. */
export type CartView = {
  status: CartStatus;
  lines: CartLine[];
  unitCount: number;
  isEmpty: boolean;
  isReady: boolean;
  isSyncing: boolean;
  pendingSync: boolean;
  pricing: CartPricingForDisplay;
  checkoutUrl: string | null;
  discountCodes: CartDiscountCode[];
};

export type CartAddItemInput = AddToCartInput;

export type CartDiscountResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export type { CartLine, CartDiscountCode, CartRecoveryResult, CartPricingForDisplay };

export function cartUnitCount(lines: readonly { qty: number }[]): number {
  return lines.reduce((total, line) => total + line.qty, 0);
}

export function cartViewFromState(input: {
  hasHydrated: boolean;
  isSyncingShopify: boolean;
  pendingCartSync: boolean;
  lines: CartLine[];
  pricing: CartPricingForDisplay;
  checkoutUrl: string | null;
  storeCheckoutUrl: string | null;
  shopifyDiscountCodes: CartDiscountCode[];
  errorMessage?: string | null;
}): CartView {
  const isReady = input.hasHydrated;
  const isSyncing = input.isSyncingShopify || input.pendingCartSync;

  let status: CartStatus = 'READY';
  if (!isReady) status = 'HYDRATING';
  else if (input.errorMessage) status = 'ERROR';
  else if (isSyncing) status = 'SYNCING';

  return {
    status,
    lines: input.lines,
    unitCount: cartUnitCount(input.lines),
    isEmpty: input.lines.length === 0,
    isReady,
    isSyncing,
    pendingSync: input.pendingCartSync,
    pricing: input.pricing,
    checkoutUrl: input.storeCheckoutUrl ?? input.checkoutUrl,
    discountCodes: input.shopifyDiscountCodes,
  };
}

export function isCartReady(status: CartStatus): boolean {
  return status !== 'HYDRATING';
}
