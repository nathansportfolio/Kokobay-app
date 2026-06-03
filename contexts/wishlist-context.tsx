import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';

import { trackAddToWishlist, trackRemoveFromWishlist } from '@/lib/gtm';
import {
  isForegroundAuditEnabled,
  isForegroundAuditWindowActive,
  recordForegroundAuditStoreUpdate,
} from '@/lib/foreground-audit';
import {
  isJsFreezeAuditEnabled,
  recordJsFreezeLongTask,
  recordJsFreezeStoreUpdate,
} from '@/lib/js-freeze-audit';
import { recordWishlistMapReferenceChange } from '@/lib/product-card-storm-trace';
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
  recordWishlistMapReferenceChange(handles);
  for (const listener of wishlistHandleListeners) listener();
}

let wishlistPersistTimer: ReturnType<typeof setTimeout> | undefined;

const LONG_TASK_THRESHOLD_MS = 16;

function applyWishlistEntriesUpdate(
  prev: WishlistEntry[],
  value: SetStateAction<WishlistEntry[]>,
): WishlistEntry[] {
  return typeof value === 'function' ? value(prev) : value;
}

function traceWishlistSetState(
  setState: Dispatch<SetStateAction<WishlistEntry[]>>,
  value: SetStateAction<WishlistEntry[]>,
): void {
  setState((prev) => {
    const start = performance.now();
    const next = applyWishlistEntriesUpdate(prev, value);
    const durationMs = performance.now() - start;
    if (isJsFreezeAuditEnabled()) {
      recordJsFreezeLongTask('wishlist.setState', durationMs, LONG_TASK_THRESHOLD_MS);
      recordJsFreezeStoreUpdate('wishlist', ['entries'], durationMs);
    }
    return next;
  });
}

export function WishlistProvider({ children }: PropsWithChildren) {
  const [wishlistEntries, setWishlistEntriesState] = useState<WishlistEntry[]>([]);
  const [wishlistHydrated, setWishlistHydratedState] = useState(false);

  const setWishlistEntries = useCallback((value: SetStateAction<WishlistEntry[]>) => {
    traceWishlistSetState(setWishlistEntriesState, value);
  }, []);

  const setWishlistHydrated = useCallback((value: SetStateAction<boolean>) => {
    setWishlistHydratedState((prev) => {
      const start = performance.now();
      const next = typeof value === 'function' ? value(prev) : value;
      const durationMs = performance.now() - start;
      if (isJsFreezeAuditEnabled()) {
        recordJsFreezeLongTask('wishlist.setHydrated', durationMs, LONG_TASK_THRESHOLD_MS);
        recordJsFreezeStoreUpdate('wishlist', ['hydrated'], durationMs);
      }
      return next;
    });
  }, []);

  const wishlistHandles = useMemo(
    () => wishlistHandlesFromEntries(wishlistEntries),
    [wishlistEntries],
  );

  useEffect(() => {
    publishWishlistHandleSet(wishlistHandles);
  }, [wishlistHandles]);

  useEffect(() => {
    if (!isForegroundAuditEnabled() || !isForegroundAuditWindowActive()) return;
    recordForegroundAuditStoreUpdate('wishlist', ['entries', 'hydrated']);
  }, [wishlistEntries, wishlistHydrated]);

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

/** Dev-only snapshot read — does not subscribe (for render diff tracing). */
export function readWishlistHandleSnapshot(handle: string): boolean {
  const normalized = handle.trim();
  return normalized ? wishlistHandleSetSnapshot.has(normalized) : false;
}

/** Dev-only — current wishlist Set reference (for ProductCard diff tracing). */
export function readWishlistHandleSetReference(): Set<string> {
  return wishlistHandleSetSnapshot;
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
