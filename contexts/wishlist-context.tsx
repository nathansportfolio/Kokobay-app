import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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

type WishlistActionsContextValue = {
  toggleWishlist: (handle: string) => void;
};

const WishlistActionsContext = createContext<WishlistActionsContextValue | null>(null);

const wishlistHandleListeners = new Set<() => void>();
let wishlistHandleSetSnapshot = new Set<string>();

function subscribeWishlistHandles(listener: () => void): () => void {
  wishlistHandleListeners.add(listener);
  return () => wishlistHandleListeners.delete(listener);
}

function publishWishlistHandleSet(handles: string[]): void {
  wishlistHandleSetSnapshot = new Set(handles);
  for (const listener of wishlistHandleListeners) listener();
}

let wishlistPersistTimer: ReturnType<typeof setTimeout> | undefined;

export function WishlistProvider({ children }: PropsWithChildren) {
  const [wishlistEntries, setWishlistEntries] = useState<WishlistEntry[]>([]);
  const [wishlistHydrated, setWishlistHydrated] = useState(false);

  const wishlistHandles = useMemo(
    () => wishlistHandlesFromEntries(wishlistEntries),
    [wishlistEntries],
  );

  useEffect(() => {
    publishWishlistHandleSet(wishlistHandles);
  }, [wishlistHandles]);

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

  const actionsValue = useMemo(() => ({ toggleWishlist }), [toggleWishlist]);

  return (
    <WishlistActionsContext.Provider value={actionsValue}>
      <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
    </WishlistActionsContext.Provider>
  );
}

/** Per-handle subscription — only re-renders when this product's wishlist state changes. */
export function useIsWishlistedHandle(handle: string): boolean {
  const normalized = handle.trim();
  return useSyncExternalStore(
    subscribeWishlistHandles,
    () => (normalized ? wishlistHandleSetSnapshot.has(normalized) : false),
    () => false,
  );
}

/** Stable toggle action — does not subscribe to wishlist membership changes. */
export function useWishlistToggle(): (handle: string) => void {
  const ctx = useContext(WishlistActionsContext);
  if (!ctx) {
    throw new Error('useWishlistToggle must be used within WishlistProvider');
  }
  return ctx.toggleWishlist;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return ctx;
}
