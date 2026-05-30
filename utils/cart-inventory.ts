import type { ProductVariant } from '@/types/shopify';
import type { ToastPayload } from '@/types/toast';

const MAX_CART_QTY = 99;

/** Normalize catalog inventory to a cart clamp cap, when a finite count is known. */
export function resolveQuantityCap(raw: number | null | undefined): number | undefined {
  if (raw == null || !Number.isFinite(raw)) return undefined;
  const n = Math.floor(raw);
  if (n < 1) return undefined;
  return Math.min(MAX_CART_QTY, n);
}

export function resolveVariantQuantityCap(variant: Pick<ProductVariant, 'quantityAvailable'>): number | undefined {
  return resolveQuantityCap(variant.quantityAvailable);
}

export function clampCartQuantity(
  requested: number,
  maxQty?: number,
): { qty: number; capped: boolean } {
  const safe = Math.min(MAX_CART_QTY, Math.max(1, Math.floor(Number.isFinite(requested) ? requested : 1)));
  if (maxQty == null || maxQty < 1) return { qty: safe, capped: false };
  const cap = Math.min(MAX_CART_QTY, Math.floor(maxQty));
  if (safe <= cap) return { qty: safe, capped: false };
  return { qty: cap, capped: true };
}

export type InventoryLimitToastOptions = {
  /** What the user asked for when it differs from the amount applied. */
  requested?: number;
  /** `add` = increment added; `set` = line qty after update; `max` = already at stock cap. */
  kind?: 'add' | 'set' | 'max';
};

export function inventoryLimitToast(qty: number, options?: InventoryLimitToastOptions): ToastPayload {
  const n = Math.max(1, Math.floor(qty));
  const kind = options?.kind ?? 'max';
  const requested =
    options?.requested != null ? Math.floor(options.requested) : undefined;

  if (kind === 'add' && requested != null && requested > n) {
    return {
      variant: 'warning',
      title: n === 1 ? 'Only 1 added to your bag' : `Only ${n} added to your bag`,
      description:
        n === 1
          ? `Only 1 in stock — you requested ${requested}`
          : `Only ${n} in stock — you requested ${requested}`,
    };
  }

  if (kind === 'set' && requested != null && requested > n) {
    return {
      variant: 'warning',
      title: n === 1 ? 'Only 1 in your bag' : `Only ${n} in your bag`,
      description:
        n === 1
          ? `Only 1 in stock — you requested ${requested}`
          : `Only ${n} in stock — you requested ${requested}`,
    };
  }

  return {
    variant: 'warning',
    title: n === 1 ? 'Only 1 in stock' : `Only ${n} in stock`,
    description: 'That\u2019s all we have available',
  };
}
