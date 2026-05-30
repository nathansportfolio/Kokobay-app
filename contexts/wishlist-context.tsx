import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { trackAddToWishlist, trackRemoveFromWishlist } from '@/lib/gtm';
import { showToast } from '@/store/toast';
import { loadWishlistHandles, persistWishlistHandles } from '@/store/wishlist-persist';

export type WishlistContextValue = {
  wishlistHandles: string[];
  wishlistCount: number;
  isWishlisted: (handle: string) => boolean;
  toggleWishlist: (handle: string) => void;
  wishlistHydrated: boolean;
  reloadWishlist: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

let wishlistPersistTimer: ReturnType<typeof setTimeout> | undefined;

export function WishlistProvider({ children }: PropsWithChildren) {
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
      wishlistHandles,
      wishlistCount,
      isWishlisted,
      toggleWishlist,
      wishlistHydrated,
      reloadWishlist,
    }),
    [
      wishlistHandles,
      wishlistCount,
      isWishlisted,
      toggleWishlist,
      wishlistHydrated,
      reloadWishlist,
    ],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return ctx;
}
