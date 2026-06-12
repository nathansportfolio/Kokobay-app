import type { ShopifyCartSnapshot } from '@/services/shopify/cart';
import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';

import type { CartAppliedDiscount } from '@/utils/cart-cost-breakdown';

export type ReservedCartPricing = {
  shopifySubtotal: Money;
  shopifyTotal: Money;
  shopifyTotalTax: Money | null;
  shopifyDiscountCodes: CartDiscountCode[];
  shopifyCartDiscountAmount: Money | null;
  shopifyLineMerchandiseSubtotal: Money | null;
  shopifyLineMerchandiseTotal: Money | null;
};

export type { CartDiscountCode, CartLine } from '@/types/cart';

export type AddToCartInput = {
  handle: string;
  variantId: string;
  qty: number;
  title?: string;
  variantTitle?: string;
  imageUrl?: string | null;
  unitPrice?: Money;
  /** Known catalog stock — caps optimistic qty before Shopify rejects. */
  quantityAvailable?: number | null;
};

export type CartState = {
  lines: CartLine[];
  shopifyCartId: string | null;
  /** Shopify Storefront checkoutUrl from cart sync — preferred checkout entry. */
  checkoutUrl: string | null;
  /** Alias for checkoutUrl (same value) — used in checkout logs and guards. */
  storeCheckoutUrl: string | null;
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  shopifyTotalTax: Money | null;
  shopifyDiscountCodes: CartDiscountCode[];
  shopifyCartDiscountAmount: Money | null;
  shopifyLineMerchandiseSubtotal: Money | null;
  shopifyLineMerchandiseTotal: Money | null;
  reservedDiscountPricing: ReservedCartPricing | null;
  displayAppliedDiscounts: CartAppliedDiscount[];
  isSyncingShopify: boolean;
  pendingCartSync: boolean;
  /** Line variant ids with a qty mutation awaiting remote cart pricing. */
  quantitySyncPendingByVariantId: Record<string, true>;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  syncWithShopify: (customerEmail?: string) => Promise<void>;
  addToCart: (params: AddToCartInput) => void;
  /** @deprecated use addToCart */
  addToBag: (params: AddToCartInput) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, qty: number) => void;
  /** +/- stepper — reads latest qty from store so rapid taps debounce correctly. */
  nudgeCartLineQuantity: (variantId: string, delta: number) => void;
  clear: () => void;
  applyRemoteSnapshot: (snapshot: ShopifyCartSnapshot, reconciledLines?: CartLine[]) => void;
};

export type CartRecoveryResult = {
  ok: boolean;
  message: string;
  lineCount?: number;
};
