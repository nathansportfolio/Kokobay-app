import type { CartLine } from '@/types/cart';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

export type CartLineReconciliationMode = 'optimistic' | 'server_authoritative';

export const MAX_CART_LINE_QTY = 99;

export function cartLinesMatchVariant(line: CartLine, variantId: string): boolean {
  return shopifyVariantKey(line.variantId) === shopifyVariantKey(variantId);
}

export function clampCartLineQty(q: number): number {
  return Math.min(
    MAX_CART_LINE_QTY,
    Math.max(1, Math.floor(Number.isFinite(q) ? q : 1)),
  );
}

export function mergeCartLineMaxQty(
  prev: number | undefined,
  next: number | undefined,
): number | undefined {
  if (next == null) return prev;
  if (prev == null) return next;
  return Math.min(prev, next);
}

/**
 * Full reconcile — bag lines match the remote snapshot exactly (drops local-only ghost lines).
 * Preserves local display metadata when the snapshot omits it.
 */
export function reconcileCartLinesServerAuthoritative(
  local: CartLine[],
  remote: CartLine[],
): CartLine[] {
  const localByVariant = new Map(
    local.map((line) => [shopifyVariantKey(line.variantId), line]),
  );
  return remote.map((remoteLine) => {
    const localLine = localByVariant.get(shopifyVariantKey(remoteLine.variantId));
    if (!localLine) return remoteLine;
    return {
      ...remoteLine,
      handle: remoteLine.handle?.trim() ? remoteLine.handle : localLine.handle,
      title: remoteLine.title ?? localLine.title,
      variantTitle: remoteLine.variantTitle ?? localLine.variantTitle,
      imageUrl: remoteLine.imageUrl ?? localLine.imageUrl,
      listUnitPrice:
        remoteLine.listUnitPrice ??
        localLine.listUnitPrice ??
        localLine.unitPrice ??
        remoteLine.unitPrice,
    };
  });
}
