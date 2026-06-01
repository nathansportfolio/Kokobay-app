import type { Money } from './shopify';

/** One row in the bag — variant-aware (Shopify-style) */
export type CartLine = {
  handle: string;
  variantId: string;
  qty: number;
  /** Storefront cart line id — set after Shopify sync */
  shopifyLineId?: string;
  /** Snapshot from add-to-bag — used for images & copy when catalog is offline */
  title?: string;
  variantTitle?: string;
  imageUrl?: string | null;
  /** Unit price at add-to-bag — used for cart totals when the live catalog is unavailable. */
  unitPrice?: Money;
  /** Original list unit price before cart-level discounts — used for discount row display. */
  listUnitPrice?: Money;
  /** Known stock cap from catalog or last Shopify reconcile — clamps optimistic qty. */
  maxQty?: number;
};

export type CartDiscountCode = {
  code: string;
  applicable: boolean;
  /** Discount value from cart API (`discountCodes[].amount`). */
  amount?: Money;
};
