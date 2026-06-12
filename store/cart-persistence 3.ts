import { recordHydration } from '@/lib/lifecycle-perf';
import { cartSyncTrace, logCartStateTransition } from '@/lib/cart-perf-log';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import type { CartLine } from '@/types/cart';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

import {
  cartLineMissingPersistedDisplay,
  loadPersistedCart,
  loadShopifyCartId,
  persistCartLines,
} from './cart-persist';
import { clampCartLineQty, mergeCartLineMaxQty } from './cart-line-utils';

const PERSIST_DEBOUNCE_MS = 140;

let persistTimer: ReturnType<typeof setTimeout> | undefined;
/** Prevents concurrent hydrate (auth merge + app bootstrap) from summing persisted qty twice. */
let cartHydratePromise: Promise<void> | null = null;

function mergeCartLines(disk: CartLine[], memory: CartLine[]): CartLine[] {
  const map = new Map<string, CartLine>();
  const key = (l: CartLine) => `${l.handle}::${shopifyVariantKey(l.variantId)}`;
  for (const l of [...disk, ...memory]) {
    const k = key(l);
    const prev = map.get(k);
    if (prev) {
      map.set(k, {
        ...l,
        qty: clampCartLineQty(prev.qty + l.qty),
        maxQty: mergeCartLineMaxQty(prev.maxQty, l.maxQty),
        listUnitPrice: prev.listUnitPrice ?? l.listUnitPrice ?? prev.unitPrice ?? l.unitPrice,
      });
    } else {
      map.set(k, { ...l, qty: clampCartLineQty(l.qty) });
    }
  }
  return [...map.values()];
}

export type CartPersistenceHydrateDeps = {
  getRevision: () => number;
  getLastSyncedRevision: () => number;
  bumpRevision: (source: string) => void;
  scheduleSync: (source: string) => void;
  finishHydrationPostSync: () => void;
};

type CartHydrateGetState = () => {
  hasHydrated: boolean;
  lines: CartLine[];
};

type CartHydrateSetState = (
  partial:
    | Partial<{ lines: CartLine[]; shopifyCartId: string | null; hasHydrated: boolean }>
    | ((state: { lines: CartLine[] }) => Partial<{
        lines: CartLine[];
        shopifyCartId: string | null;
        hasHydrated: boolean;
      }>),
) => void;

/** Load SecureStore cart lines + shopify cart id into Zustand. */
export function runCartPersistenceHydrate(
  getState: CartHydrateGetState,
  setState: CartHydrateSetState,
  deps: CartPersistenceHydrateDeps,
): Promise<void> {
  if (getState().hasHydrated) return Promise.resolve();
  if (cartHydratePromise) return cartHydratePromise;

  cartHydratePromise = (async () => {
    if (__DEV__) recordHydration('cart', getState().hasHydrated);
    if (getState().hasHydrated) return;

    const [loaded, shopifyCartId] = await Promise.all([loadPersistedCart(), loadShopifyCartId()]);
    setState((s) => ({
      // Prefer SecureStore on cold start; only merge when optimistic lines exist pre-hydrate.
      lines: s.lines.length > 0 ? mergeCartLines(loaded, s.lines) : loaded,
      shopifyCartId,
      hasHydrated: true,
    }));

    const lines = getState().lines;
    logCartStateTransition('hydrate:loaded', lines.length, deps.getRevision(), {
      persistedCount: loaded.length,
      shopifyCartId: shopifyCartId ?? null,
    });
    const missingDisplayLines = lines.filter(cartLineMissingPersistedDisplay);
    const needsRemoteHydrateSync =
      isRemoteCartConfigured() &&
      lines.length > 0 &&
      (!shopifyCartId ||
        lines.some((line) => !line.shopifyLineId?.trim()) ||
        missingDisplayLines.length > 0);

    if (needsRemoteHydrateSync) {
      deps.bumpRevision('hydrate');
      deps.scheduleSync(missingDisplayLines.length > 0 ? 'hydrate:missing_display' : 'hydrate');
      deps.finishHydrationPostSync();
      return;
    }

    if (lines.length > 0) {
      // Persisted lines/cart id are trusted for display, but checkoutUrl and Shopify
      // totals are not persisted — schedule a background sync instead of marking clean.
      cartSyncTrace('hydrate_deferred_sync', {
        reason: 'persisted_session_checkout_refresh',
        lineCount: lines.length,
        shopifyCartId: shopifyCartId ?? null,
      });
      deps.bumpRevision('hydrate:checkout_refresh');
      deps.scheduleSync('hydrate:trusted_persisted');
      logCartStateTransition('hydrate_deferred_sync', lines.length, deps.getRevision(), {
        reason: 'persisted_session_checkout_refresh',
        lastSyncedRevision: deps.getLastSyncedRevision(),
      });
    }

    deps.finishHydrationPostSync();
  })().finally(() => {
    cartHydratePromise = null;
  });

  return cartHydratePromise;
}

export type CartLinePersistenceStore = {
  getState: () => { hasHydrated: boolean; lines: CartLine[] };
  setState: (partial: { lines: CartLine[] }) => void;
  subscribe: (
    listener: (
      state: { hasHydrated: boolean; lines: CartLine[] },
      prev: { hasHydrated: boolean; lines: CartLine[] },
    ) => void,
  ) => () => void;
};

/** Debounce SecureStore writes; rollback in-memory cart if persistence fails (optimistic UI). */
export function wireDebouncedCartLinePersistence(
  store: CartLinePersistenceStore,
  getRevision: () => number,
): () => void {
  return store.subscribe((state, prev) => {
    if (!state.hasHydrated) return;
    if (state.lines === prev.lines) return;
    if (persistTimer) clearTimeout(persistTimer);
    const snapshot = state.lines;
    const rollback = prev.lines;
    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      void (async () => {
        const ok = await persistCartLines(snapshot);
        if (!ok) {
          logCartStateTransition('persist_rollback', rollback.length, getRevision(), {
            attemptedLineCount: snapshot.length,
          });
          store.setState({ lines: rollback });
        }
      })();
    }, PERSIST_DEBOUNCE_MS);
  });
}

export function cancelCartPersistenceTimer(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = undefined;
  }
}

/** @internal Reset hydrate mutex between integration tests. */
export function resetCartHydrateStateForTests(): void {
  cartHydratePromise = null;
}
