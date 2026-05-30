import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { trackAddToCart, trackAddToWishlist, trackRemoveFromWishlist } from '@/lib/gtm';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import {
  flushCartSync,
  isCartSettledForCheckout,
  useAuthStore,
  useCartStore,
  type AddToCartInput,
} from '@/store';
import { showToast } from '@/store/toast';
import { inventoryLimitToast } from '@/utils/cart-inventory';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';
import { loadWishlistHandles, persistWishlistHandles } from '@/store/wishlist-persist';

export type AddToBagParams = AddToCartInput;

export type ShopListsContextValue = {
  /** Adds to bag and waits for remote sync before the success toast (when configured). */
  addToBag: (params: AddToBagParams) => Promise<void>;
  /** Total units across all bag lines. */
  bagUnitCount: number;
  /** Whether this variant is already in the bag. */
  isInBag: (handle: string, variantId: string) => boolean;
  /** Sorted product handles on the wishlist. */
  wishlistHandles: string[];
  wishlistCount: number;
  isWishlisted: (handle: string) => boolean;
  toggleWishlist: (handle: string) => void;
  /** True after initial SecureStore read for wishlist. */
  wishlistHydrated: boolean;
  /** Re-read wishlist handles from device storage (pull-to-refresh). */
  reloadWishlist: () => Promise<void>;
};

const ShopListsContext = createContext<ShopListsContextValue | null>(null);

let wishlistPersistTimer: ReturnType<typeof setTimeout> | undefined;

export function ShopListsProvider({ children }: PropsWithChildren) {
  const lines = useCartStore((s) => s.lines);

  const [wishlistSet, setWishlistSet] = useState(() => new Set<string>());
  const [wishlistHydrated, setWishlistHydrated] = useState(false);

  useEffect(() => {
    void loadWishlistHandles().then((handles) => {
      setWishlistSet(new Set(handles));
      setWishlistHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!wishlistHydrated) return;
    if (wishlistPersistTimer) clearTimeout(wishlistPersistTimer);
    const snapshot = [...wishlistSet].sort();
    wishlistPersistTimer = setTimeout(() => {
      wishlistPersistTimer = undefined;
      void persistWishlistHandles(snapshot);
    }, 140);
    return () => {
      if (wishlistPersistTimer) clearTimeout(wishlistPersistTimer);
    };
  }, [wishlistSet, wishlistHydrated]);

  const addToBag = useCallback(async (params: AddToCartInput) => {
    const variantKey = shopifyVariantKey(params.variantId);
    const lineKey = (l: { handle: string; variantId: string }) =>
      l.handle === params.handle && shopifyVariantKey(l.variantId) === variantKey;

    useCartStore.getState().addToCart(params);
    trackAddToCart(params);

    const hopedQty = useCartStore.getState().lines.find(lineKey)?.qty;

    if (!isRemoteCartConfigured()) {
      showToast({ variant: 'success', title: 'Added to Bag' });
      return;
    }

    const email = useAuthStore.getState().user?.email;
    await flushCartSync(email);
    if (!isCartSettledForCheckout()) return;

    const syncedQty = useCartStore.getState().lines.find(lineKey)?.qty;
    if (hopedQty != null && syncedQty != null && syncedQty < hopedQty) {
      showToast(inventoryLimitToast(syncedQty, { requested: hopedQty, kind: 'set' }));
    } else {
      showToast({ variant: 'success', title: 'Added to Bag' });
    }
  }, []);

  const bagUnitCount = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);

  const isInBag = useCallback(
    (handle: string, variantId: string) =>
      lines.some((l) => l.handle === handle && l.variantId === variantId),
    [lines],
  );

  const wishlistHandles = useMemo(() => [...wishlistSet].sort(), [wishlistSet]);

  const wishlistCount = wishlistHandles.length;

  const isWishlisted = useCallback(
    (handle: string) => {
      const h = handle.trim();
      return h.length > 0 && wishlistSet.has(h);
    },
    [wishlistSet],
  );

  const toggleWishlist = useCallback(
    (handle: string) => {
      const h = handle.trim();
      if (!h) return;
      const wasPresent = wishlistSet.has(h);
      setWishlistSet((prev) => {
        const next = new Set(prev);
        if (prev.has(h)) next.delete(h);
        else next.add(h);
        return next;
      });
      if (wasPresent) {
        trackRemoveFromWishlist({ handle: h });
      } else {
        trackAddToWishlist({ handle: h });
      }
      showToast(
        wasPresent
          ? { variant: 'info', title: 'Removed from wishlist' }
          : { variant: 'success', title: 'Saved' },
      );
    },
    [wishlistSet],
  );

  const reloadWishlist = useCallback(async () => {
    const handles = await loadWishlistHandles();
    setWishlistSet(new Set(handles));
    setWishlistHydrated(true);
  }, []);

  const value = useMemo(
    () => ({
      addToBag,
      bagUnitCount,
      isInBag,
      wishlistHandles,
      wishlistCount,
      isWishlisted,
      toggleWishlist,
      wishlistHydrated,
      reloadWishlist,
    }),
    [
      addToBag,
      bagUnitCount,
      isInBag,
      wishlistHandles,
      wishlistCount,
      isWishlisted,
      toggleWishlist,
      wishlistHydrated,
      reloadWishlist,
    ],
  );

  return <ShopListsContext.Provider value={value}>{children}</ShopListsContext.Provider>;
}

export function useShopLists(): ShopListsContextValue {
  const ctx = useContext(ShopListsContext);
  if (!ctx) {
    throw new Error('useShopLists must be used within ShopListsProvider');
  }
  return ctx;
}
