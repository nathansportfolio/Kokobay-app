import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';

import { cartEngine } from '@/src/core/cart';
import type { CartAddItemInput } from '@/src/core/cart';
import { useCartBagLineKeys, useCartBagUnitCount } from '@/hooks/use-cart-selectors';
import { trackAddToCart } from '@/lib/gtm';
import { showToast } from '@/store/toast';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

export type AddToBagParams = CartAddItemInput;

export type BagActionsContextValue = {
  /** Optimistic add — remote sync is debounced via `scheduleSync` in the cart store. */
  addToBag: (params: AddToBagParams) => void;
};

export type BagStateContextValue = {
  bagUnitCount: number;
  isInBag: (handle: string, variantId: string) => boolean;
  bagLineKeys: string[];
};

const BagActionsContext = createContext<BagActionsContextValue | null>(null);
const BagStateContext = createContext<BagStateContextValue | null>(null);

function BagActionsProvider({ children }: PropsWithChildren) {
  const addToBag = useCallback((params: CartAddItemInput) => {
    cartEngine.addItem(params);
    trackAddToCart(params);
    showToast({ variant: 'success', title: 'Added to Bag', position: 'bottom' });
  }, []);

  const value = useMemo(() => ({ addToBag }), [addToBag]);

  return <BagActionsContext.Provider value={value}>{children}</BagActionsContext.Provider>;
}

function BagStateProvider({ children }: PropsWithChildren) {
  const bagUnitCount = useCartBagUnitCount();
  const bagLineKeys = useCartBagLineKeys();

  const isInBag = useCallback(
    (handle: string, variantId: string) => {
      const key = `${handle}::${shopifyVariantKey(variantId)}`;
      return bagLineKeys.includes(key);
    },
    [bagLineKeys],
  );

  const value = useMemo(
    () => ({
      bagUnitCount,
      isInBag,
      bagLineKeys,
    }),
    [bagUnitCount, isInBag, bagLineKeys],
  );

  return <BagStateContext.Provider value={value}>{children}</BagStateContext.Provider>;
}

export function BagProvider({ children }: PropsWithChildren) {
  return (
    <BagActionsProvider>
      <BagStateProvider>{children}</BagStateProvider>
    </BagActionsProvider>
  );
}

export function useBagActions(): BagActionsContextValue {
  const ctx = useContext(BagActionsContext);
  if (!ctx) {
    throw new Error('useBagActions must be used within BagProvider');
  }
  return ctx;
}

export function useBagState(): BagStateContextValue {
  const ctx = useContext(BagStateContext);
  if (!ctx) {
    throw new Error('useBagState must be used within BagProvider');
  }
  return ctx;
}
