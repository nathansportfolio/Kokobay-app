import { useShallow } from 'zustand/react/shallow';

import { useCartStore } from '@/store/cart';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

type CartLinesSlice = { lines: { handle: string; variantId: string; qty: number }[] };

/** Total units across all bag lines — avoids subscribing to full line objects. */
export function selectCartBagUnitCount(s: CartLinesSlice): number {
  return s.lines.reduce((n, l) => n + l.qty, 0);
}

export function useCartBagUnitCount(): number {
  return useCartStore(selectCartBagUnitCount);
}

export function selectIsVariantInBag(handle: string, variantId: string) {
  const variantKey = shopifyVariantKey(variantId);
  return (s: CartLinesSlice) =>
    s.lines.some((l) => l.handle === handle && shopifyVariantKey(l.variantId) === variantKey);
}

export function useIsVariantInBag(handle: string, variantId: string): boolean {
  return useCartStore(selectIsVariantInBag(handle, variantId));
}

/** Narrow subscription: line keys only (for `isInBag` callbacks that must re-render). */
export function useCartBagLineKeys(): string[] {
  return useCartStore(
    useShallow((s) =>
      s.lines.map((l) => `${l.handle}::${shopifyVariantKey(l.variantId)}`),
    ),
  );
}
