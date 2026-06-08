import { useShallow } from 'zustand/react/shallow';

import { selectCartBagUnitCount } from '@/hooks/use-cart-selectors';
import { useCartStore } from '@/store/cart';
import { selectCartPricingForDisplay } from '@/store/cart-pricing';
import type { CartState } from '@/store/cart-types';
import { singleLineOverServerSubtotalVariantId } from '@/utils/cart-line-stock';

export function selectCartScreenState(s: CartState) {
  return {
    lines: s.lines,
    hasHydrated: s.hasHydrated,
    bagUnitCount: selectCartBagUnitCount(s),
    viewCartLineKey: s.lines.map((line) => `${line.variantId}:${line.qty}`).join('|'),
    quantitySyncPendingByVariantId: s.quantitySyncPendingByVariantId,
    cartPricingForDisplay: selectCartPricingForDisplay(s),
    overServerSubtotalVariantId: singleLineOverServerSubtotalVariantId(
      s.lines,
      s.shopifySubtotal,
      s.shopifyDiscountCodes,
    ),
  };
}

export function useCartScreenState() {
  return useCartStore(useShallow(selectCartScreenState));
}
