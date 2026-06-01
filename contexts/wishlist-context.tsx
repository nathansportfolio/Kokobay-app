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
import {
  loadWishlistEntries,
  persistWishlistEntries,
  wishlistHandlesFromEntries,
} from '@/store/wishlist-persist';
import type { WishlistEntry } from '@/types/wishlist';

export type WishlistContextValue = {
  /** Newest saved first — used for wishlist grid order. */
  wishlistHandles: string[];
  /** Same order as `wishlistHandles`, with save timestamps. */
  wishlistEntries: WishlistEntry[];
  wishlistCount: number;
  isWishlisted: (handle: string) => boolean;
  toggleWishlist: (handle: string) => void;
  wishlistHydrated: boolean;
  reloadWishlist: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

let wishlistPersistTimer: ReturnType<typeof setTimeout> | undefined;

export function WishlistProvider({ children }: PropsWithChildren) {
  const [wishlistEntries, setWishlistEntries] = useState<WishlistEntry[]>([]);
  const [wishlistHydrated, setWishlistHydrated] = useState(false);

  const wishlistHandles = useMemo(
    () => wishlistHandlesFromEntries(wishlistEntries),
    [wishlistEntries],
  );

  const wishlistSet = useMemo(() => new Set(wishlistHandles), [wishlistHandles]);

  useEffect(() => {
    void loadWishlistEntries().then((entries) => {
      setWishlistEntries(entries);
      setWishlistHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!wishlistHydrated) return;
    if (wishlistPersistTimer) clearTimeout(wishlistPersistTimer);
    const snapshot = [...wishlistEntries];
    wishlistPersistTimer = setTimeout(() => {
      wishlistPersistTimer = undefined;
      void persistWishlistEntries(snapshot);
    }, 140);
    return () => {
      if (wishlistPersistTimer) clearTimeout(wishlistPersistTimer);
    };
  }, [wishlistEntries, wishlistHydrated]);

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
      const addedAt = new Date().toISOString();
      setWishlistEntries((prev) => {
        if (prev.some((entry) => entry.handle === h)) {
          return prev.filter((entry) => entry.handle !== h);
        }
        return [{ handle: h, addedAt }, ...prev.filter((entry) => entry.handle !== h)];
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
    const entries = await loadWishlistEntries();
    setWishlistEntries(entries);
    setWishlistHydrated(true);
  }, []);

  const value = useMemo(
    () => ({
      wishlistHandles,
      wishlistEntries,
      wishlistCount,
      isWishlisted,
      toggleWishlist,
      wishlistHydrated,
      reloadWishlist,
    }),
    [
      wishlistHandles,
      wishlistEntries,
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
