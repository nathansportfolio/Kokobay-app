import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { cartViewFromState } from '@/src/core/cart/types';
import type { CartView } from '@/src/core/cart/types';
import { selectCartPricingForDisplay, useCartStore } from '@/store/cart';

/** Screen hook — read-only cart view. Mutations go through `cartEngine`. */
export function useCart(): CartView {
  const slice = useCartStore(
    useShallow((s) => ({
      hasHydrated: s.hasHydrated,
      isSyncingShopify: s.isSyncingShopify,
      pendingCartSync: s.pendingCartSync,
      lines: s.lines,
      checkoutUrl: s.checkoutUrl,
      storeCheckoutUrl: s.storeCheckoutUrl,
      shopifyDiscountCodes: s.shopifyDiscountCodes,
      pricing: selectCartPricingForDisplay(s),
    })),
  );

  return useMemo(() => cartViewFromState(slice), [slice]);
}
