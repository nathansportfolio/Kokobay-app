import { create } from 'zustand';
import { AppState } from 'react-native';

import { isRemoteCartConfigured, usesKokobayCartProxy } from '@/services/cart/remote-cart';
import { patchCartQuantityFast, syncLocalCartToRemote } from '@/services/cart/sync';
import { cartPerfLog } from '@/lib/cart-perf-log';
import { reportOperationalFailure } from '@/lib/appErrorLog';
import { trackRemoveFromCart } from '@/lib/gtm';
import { showToast } from '@/store/toast';
import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';
import { clampCartQuantity, inventoryLimitToast, resolveQuantityCap } from '@/utils/cart-inventory';
import {
  ensureDeliveryThresholdLoaded,
  getDeliveryThresholdGbpSync,
} from '@/services/delivery-threshold';
import { computeCartSubtotal, computeEstimatedTotal, computeShippingEstimate } from '@/utils/cart-totals';
import { hasCartLinePricing } from '@/utils/cart-line-pricing';
import { cartSyncErrorToast } from '@/utils/cart-sync-messages';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

import { createCartSyncScheduler } from './cart-sync-scheduler';
import {
  loadCartGuestId,
  loadPersistedCart,
  loadShopifyCartId,
  persistCartGuestId,
  persistCartLines,
  persistShopifyCartId,
} from './cart-persist';

const MAX_QTY = 99;

function clampQty(q: number): number {
  return Math.min(MAX_QTY, Math.max(1, Math.floor(Number.isFinite(q) ? q : 1)));
}

function mergeMaxQty(prev: number | undefined, next: number | undefined): number | undefined {
  if (next == null) return prev;
  if (prev == null) return next;
  return Math.min(prev, next);
}

/**
 * Keep footer subtotal in sync with qty changes before Shopify sync returns.
 * For remote Shopify carts, do not add the local £3.99 estimate to `shopifyTotal` —
 * that made delivery flicker to £3.99 until GET /api/cart completed.
 */
function optimisticCartTotals(lines: CartLine[]): {
  shopifySubtotal: Money;
  shopifyTotal: Money;
} | null {
  if (!hasCartLinePricing(lines)) return null;
  const shopifySubtotal = computeCartSubtotal(lines);
  if (isRemoteCartConfigured()) {
    return { shopifySubtotal, shopifyTotal: shopifySubtotal };
  }
  const shipping = computeShippingEstimate(shopifySubtotal, getDeliveryThresholdGbpSync());
  return {
    shopifySubtotal,
    shopifyTotal: computeEstimatedTotal(shopifySubtotal, shipping),
  };
}

function refreshOptimisticCartTotalsAfterThresholdLoad(): void {
  const { lines, shopifyTotalTax } = useCartStore.getState();
  const totals = optimisticCartTotals(lines);
  if (!totals) return;
  useCartStore.setState({
    shopifySubtotal: totals.shopifySubtotal,
    shopifyTotal: totals.shopifyTotal,
    shopifyTotalTax,
  });
}

function requestDeliveryThresholdForCartEdits(): void {
  void ensureDeliveryThresholdLoaded().then(() => {
    refreshOptimisticCartTotalsAfterThresholdLoad();
  });
}

function mergeCartLines(disk: CartLine[], memory: CartLine[]): CartLine[] {
  const map = new Map<string, CartLine>();
  const key = (l: CartLine) => `${l.handle}::${shopifyVariantKey(l.variantId)}`;
  for (const l of [...disk, ...memory]) {
    const k = key(l);
    const prev = map.get(k);
    if (prev) {
      map.set(k, {
        ...l,
        qty: clampQty(prev.qty + l.qty),
        maxQty: mergeMaxQty(prev.maxQty, l.maxQty),
      });
    } else {
      map.set(k, { ...l, qty: clampQty(l.qty) });
    }
  }
  return [...map.values()];
}

/** Apply Shopify cart as source of truth for qty and line metadata after sync. */
function mergeSyncedCartLines(
  local: CartLine[],
  remote: CartLine[],
  options?: { dropLinesMissingOnRemote?: boolean; learnInventoryCap?: boolean },
): CartLine[] {
  const remoteByVariant = new Map(remote.map((line) => [shopifyVariantKey(line.variantId), line]));
  const merged = local.map((line) => {
    const synced = remoteByVariant.get(shopifyVariantKey(line.variantId));
    if (!synced) return line;
    const next: CartLine = {
      ...line,
      qty: synced.qty,
      shopifyLineId: synced.shopifyLineId ?? line.shopifyLineId,
      title: line.title ?? synced.title,
      variantTitle: line.variantTitle ?? synced.variantTitle,
      imageUrl: line.imageUrl ?? synced.imageUrl,
      unitPrice: synced.unitPrice ?? line.unitPrice,
    };
    if (options?.learnInventoryCap) {
      next.maxQty = mergeMaxQty(line.maxQty, synced.qty);
    }
    return next;
  });
  if (!options?.dropLinesMissingOnRemote) return merged;
  return merged.filter((line) => remoteByVariant.has(shopifyVariantKey(line.variantId)));
}

export type { CartLine } from '@/types/cart';

export type AddToCartInput = {
  handle: string;
  variantId: string;
  qty: number;
  title?: string;
  variantTitle?: string;
  imageUrl?: string | null;
  unitPrice?: Money;
  /** Known catalog stock — caps optimistic qty before Shopify rejects. */
  quantityAvailable?: number | null;
};

type CartState = {
  lines: CartLine[];
  shopifyCartId: string | null;
  checkoutUrl: string | null;
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  shopifyTotalTax: Money | null;
  isSyncingShopify: boolean;
  pendingCartSync: boolean;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  syncWithShopify: (customerEmail?: string) => Promise<void>;
  addToCart: (params: AddToCartInput) => void;
  /** @deprecated use addToCart */
  addToBag: (params: AddToCartInput) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, qty: number) => void;
  clear: () => void;
};

let cartRevision = 0;
/** Revision last successfully pushed to Shopify — skips no-op syncs on resume. */
let lastSyncedRevision = 0;
let forceNextSync = false;
let activeSyncGeneration = 0;
/** Variant ids queued for debounced PATCH-only quantity sync (Koko Bay proxy). */
const pendingFastQuantityVariantIds = new Set<string>();

let cartNetworkChain: Promise<void> = Promise.resolve();

function enqueueCartNetwork(task: () => Promise<void>): Promise<void> {
  const run = cartNetworkChain.then(task);
  cartNetworkChain = run.catch(() => {});
  return run;
}

function isCartDirty(): boolean {
  return cartRevision !== lastSyncedRevision;
}

function isCartSyncPending(): boolean {
  return (
    cartSyncScheduler.isDebouncePending() ||
    fastQuantityScheduler.isDebouncePending() ||
    pendingFastQuantityVariantIds.size > 0
  );
}

const cartSyncScheduler = createCartSyncScheduler(
  async (customerEmail) => {
    await enqueueCartNetwork(async () => {
      await useCartStore.getState().syncWithShopify(customerEmail);
    });
  },
  { shouldSync: isCartDirty },
);

const fastQuantityScheduler = createCartSyncScheduler(
  async (customerEmail) => {
    await enqueueCartNetwork(async () => {
      await syncQuantityFast(customerEmail);
    });
  },
  {
    shouldSync: () => pendingFastQuantityVariantIds.size > 0 && isCartDirty(),
  },
);

function finalizePendingCartSync(): void {
  const { isSyncingShopify } = useCartStore.getState();
  if (!isSyncingShopify && !isCartSyncPending()) {
    useCartStore.setState({ pendingCartSync: false });
  }
}

function scheduleSync(): void {
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  pendingFastQuantityVariantIds.clear();
  fastQuantityScheduler.cancelDebounce();
  useCartStore.setState({ pendingCartSync: true });
  cartSyncScheduler.scheduleSync();
}

function scheduleFastQuantitySync(variantId: string): void {
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  pendingFastQuantityVariantIds.add(variantId);
  cartSyncScheduler.cancelDebounce();
  useCartStore.setState({ pendingCartSync: true });
  fastQuantityScheduler.scheduleSync();
}

function canFastPathQuantitySync(line: CartLine | undefined, qty: number): boolean {
  return (
    qty >= 1 &&
    usesKokobayCartProxy() &&
    Boolean(line?.shopifyLineId?.trim())
  );
}

/** Bypass debounce — use at checkout and login only. */
export function flushCartSync(customerEmail?: string): Promise<void> {
  if (!isRemoteCartConfigured()) return Promise.resolve();
  forceNextSync = true;
  useCartStore.setState({ pendingCartSync: true });
  return Promise.all([
    fastQuantityScheduler.flushSync(customerEmail),
    cartSyncScheduler.flushSync(customerEmail),
  ]).then(() => {});
}

const CHECKOUT_SYNC_SETTLE_MS = 50;
const CHECKOUT_SYNC_MAX_ROUNDS = 10;

/** True when debounced mutations have synced and a checkout URL can be trusted. */
export function isCartSettledForCheckout(): boolean {
  const { isSyncingShopify, pendingCartSync } = useCartStore.getState();
  return (
    !isSyncingShopify &&
    !pendingCartSync &&
    !isCartSyncPending() &&
    !isCartDirty()
  );
}

/**
 * Flush debounced cart mutations and wait until Shopify sync has caught up.
 * Use before navigating to checkout so we do not open a stale checkout URL.
 */
export async function ensureCartSyncedForCheckout(customerEmail?: string): Promise<void> {
  if (!isRemoteCartConfigured()) return;

  for (let round = 0; round < CHECKOUT_SYNC_MAX_ROUNDS; round += 1) {
    await flushCartSync(customerEmail);
    if (isCartSettledForCheckout()) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, CHECKOUT_SYNC_SETTLE_MS);
    });
  }

  await flushCartSync(customerEmail);
}

function bumpCartRevision(): void {
  cartRevision += 1;
}

function logCartDebug(
  action: string,
  details: { lineItemId?: string; quantity?: number; handle?: string },
): void {
  if (!__DEV__) return;
  console.log('[CART DEBUG]', {
    action,
    lineItemId: details.lineItemId ?? null,
    quantity: details.quantity ?? null,
    handle: details.handle ?? null,
    timestamp: Date.now(),
  });
}

function applyOptimisticLineUpdate(
  lines: CartLine[],
  previous: Pick<CartState, 'shopifySubtotal' | 'shopifyTotal' | 'shopifyTotalTax'>,
): Partial<CartState> {
  const totals = optimisticCartTotals(lines);
  if (!totals) return { lines };
  return {
    lines,
    shopifySubtotal: totals.shopifySubtotal,
    shopifyTotal: totals.shopifyTotal,
    shopifyTotalTax: previous.shopifyTotalTax,
  };
}

function resolveClampedQty(
  requestedQty: number,
  maxQty: number | undefined,
): { qty: number; capped: boolean; cap?: number } {
  const { qty, capped } = clampCartQuantity(requestedQty, maxQty);
  return capped && maxQty != null ? { qty, capped, cap: maxQty } : { qty, capped: false };
}

async function applyRemoteCartSyncResult(
  revisionAtStart: number,
  syncGeneration: number,
  result: Awaited<ReturnType<typeof syncLocalCartToRemote>>,
): Promise<void> {
  if (syncGeneration !== activeSyncGeneration) return;
  if (revisionAtStart !== cartRevision) {
    scheduleSync();
    return;
  }
  if (!result) return;
  if (result.guestId) {
    await persistCartGuestId(result.guestId);
  }
  const snapshot = result.snapshot;
  if (!snapshot) return;

  const learnInventoryCap = result.syncError?.code === 'insufficient_inventory';
  const reconciledLines = mergeSyncedCartLines(useCartStore.getState().lines, snapshot.lines, {
    dropLinesMissingOnRemote: Boolean(result.syncError),
    learnInventoryCap,
  });
  useCartStore.setState({
    lines: reconciledLines,
    shopifyCartId: snapshot.cartId,
    checkoutUrl: snapshot.checkoutUrl,
    shopifySubtotal: snapshot.subtotal,
    shopifyTotal: snapshot.total,
    shopifyTotalTax: snapshot.totalTax ?? null,
  });
  await persistShopifyCartId(snapshot.cartId);

  if (result.syncError) {
    reportOperationalFailure(result.syncError.message, {
      source: 'cart_sync',
      code: result.syncError.code,
    });
    showToast(cartSyncErrorToast(result.syncError, reconciledLines));
  } else if (revisionAtStart === cartRevision) {
    lastSyncedRevision = cartRevision;
  }
}

/** PATCH-only quantity sync — bypasses GET /api/cart and reconcile. */
async function syncQuantityFast(customerEmail?: string): Promise<void> {
  if (!isRemoteCartConfigured()) return;

  const variantIds = [...pendingFastQuantityVariantIds];
  pendingFastQuantityVariantIds.clear();
  if (!variantIds.length) return;

  if (AppState.currentState !== 'active') {
    for (const id of variantIds) pendingFastQuantityVariantIds.add(id);
    for (const id of variantIds) scheduleFastQuantitySync(id);
    return;
  }

  const revisionAtStart = cartRevision;
  const syncGeneration = ++activeSyncGeneration;
  useCartStore.setState({ isSyncingShopify: true, pendingCartSync: true });

  try {
    let guestId = await loadCartGuestId();
    let lastResult: Awaited<ReturnType<typeof patchCartQuantityFast>> = null;

    for (const variantId of variantIds) {
      if (syncGeneration !== activeSyncGeneration || revisionAtStart !== cartRevision) break;

      const lines = useCartStore.getState().lines;
      const line = lines.find((l) => l.variantId === variantId);
      const lineId = line?.shopifyLineId?.trim();
      if (!line || !lineId || line.qty < 1) {
        scheduleSync();
        return;
      }

      lastResult = await patchCartQuantityFast(
        guestId,
        lineId,
        line.qty,
        lines,
        customerEmail,
      );
      if (lastResult?.guestId) guestId = lastResult.guestId;

      if (lastResult?.syncError) {
        reportOperationalFailure(lastResult.syncError.message, {
          source: 'cart_fast_sync',
          code: lastResult.syncError.code,
        });
        showToast(cartSyncErrorToast(lastResult.syncError, lines));
        scheduleSync();
        return;
      }
      if (!lastResult?.snapshot) {
        scheduleSync();
        return;
      }

      await applyRemoteCartSyncResult(revisionAtStart, syncGeneration, lastResult);
    }
  } finally {
    if (syncGeneration === activeSyncGeneration) {
      useCartStore.setState({ isSyncingShopify: false });
    }
    finalizePendingCartSync();
  }
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  shopifyCartId: null,
  checkoutUrl: null,
  shopifySubtotal: null,
  shopifyTotal: null,
  shopifyTotalTax: null,
  isSyncingShopify: false,
  pendingCartSync: false,
  hasHydrated: false,

  hydrate: async () => {
    if (get().hasHydrated) return;
    const [loaded, shopifyCartId] = await Promise.all([loadPersistedCart(), loadShopifyCartId()]);
    bumpCartRevision();
    set((s) => ({
      lines: mergeCartLines(loaded, s.lines),
      shopifyCartId,
      hasHydrated: true,
    }));
    requestDeliveryThresholdForCartEdits();
    scheduleSync();
  },

  syncWithShopify: async (customerEmail?: string) => {
    if (!isRemoteCartConfigured()) return;

    if (AppState.currentState !== 'active') {
      scheduleSync();
      finalizePendingCartSync();
      return;
    }

    const force = forceNextSync;
    forceNextSync = false;
    if (!force && !isCartDirty()) {
      finalizePendingCartSync();
      return;
    }

    const syncStoreStart = performance.now();
    const revisionAtStart = cartRevision;
    const { lines, shopifyCartId } = get();
    const guestId = await loadCartGuestId();
    cartPerfLog(
      `syncWithShopify start lines=${lines.length} revision=${revisionAtStart} ` +
        `withLineIds=${lines.filter((l) => l.shopifyLineId).length}`,
    );

    if (!lines.length) {
      set({
        shopifyCartId: null,
        checkoutUrl: null,
        shopifySubtotal: null,
        shopifyTotal: null,
        shopifyTotalTax: null,
        isSyncingShopify: false,
      });
      if (shopifyCartId || guestId) {
        await syncLocalCartToRemote(shopifyCartId, guestId, [], customerEmail);
      }
      await persistShopifyCartId(null);
      if (revisionAtStart === cartRevision) {
        lastSyncedRevision = cartRevision;
      }
      finalizePendingCartSync();
      return;
    }

    const syncGeneration = ++activeSyncGeneration;
    set({ isSyncingShopify: true, pendingCartSync: true });
    try {
      const result = await syncLocalCartToRemote(shopifyCartId, guestId, lines, customerEmail);
      await applyRemoteCartSyncResult(revisionAtStart, syncGeneration, result);
    } finally {
      if (syncGeneration === activeSyncGeneration) {
        set({ isSyncingShopify: false });
      }
      finalizePendingCartSync();
      cartPerfLog(
        `syncWithShopify finished in ${Math.round(performance.now() - syncStoreStart)}ms ` +
          `(revision ${revisionAtStart}→${cartRevision})`,
      );
    }
  },

  addToCart: ({
    handle,
    variantId,
    qty,
    title,
    variantTitle,
    imageUrl,
    unitPrice,
    quantityAvailable,
  }) => {
    const safeQty = clampQty(qty);
    const catalogCap = resolveQuantityCap(quantityAvailable);
    logCartDebug('addToCart', { lineItemId: variantId, quantity: safeQty, handle });
    bumpCartRevision();
    const snapshot = {
      ...(title !== undefined ? { title } : {}),
      ...(variantTitle !== undefined ? { variantTitle } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(unitPrice !== undefined ? { unitPrice } : {}),
    } satisfies Partial<Pick<CartLine, 'title' | 'variantTitle' | 'imageUrl' | 'unitPrice'>>;
    let inventoryCapNotice: {
      added: number;
      requested: number;
      kind: 'add' | 'max';
    } | null = null;
    set((s) => {
      const idx = s.lines.findIndex((l) => l.handle === handle && l.variantId === variantId);
      const lines =
        idx >= 0
          ? s.lines.map((l, i) => {
              if (i !== idx) return l;
              const maxQty = mergeMaxQty(l.maxQty, catalogCap);
              const rawNext = clampQty(l.qty + safeQty);
              const clamped = resolveClampedQty(rawNext, maxQty);
              if (clamped.capped) {
                const addedDelta = clamped.qty - l.qty;
                inventoryCapNotice = {
                  added: addedDelta > 0 ? addedDelta : clamped.qty,
                  requested: safeQty,
                  kind: addedDelta > 0 ? 'add' : 'max',
                };
              }
              return {
                ...l,
                qty: clamped.qty,
                maxQty,
                ...snapshot,
              };
            })
          : (() => {
              const maxQty = catalogCap;
              const clamped = resolveClampedQty(safeQty, maxQty);
              if (clamped.capped) {
                inventoryCapNotice = {
                  added: clamped.qty,
                  requested: safeQty,
                  kind: 'add',
                };
              }
              return [...s.lines, { handle, variantId, qty: clamped.qty, maxQty, ...snapshot }];
            })();
      return applyOptimisticLineUpdate(lines, s);
    });
    if (inventoryCapNotice != null) {
      const { added, requested, kind } = inventoryCapNotice;
      if (kind === 'add' && added > 0 && added < requested) {
        showToast(inventoryLimitToast(added, { requested, kind: 'add' }));
      } else if (added < requested) {
        showToast(inventoryLimitToast(added, { kind: 'max' }));
      }
    }
    requestDeliveryThresholdForCartEdits();
    scheduleSync();
  },

  addToBag: (params) => {
    get().addToCart(params);
  },

  removeItem: (variantId) => {
    const removed = get().lines.find((l) => l.variantId === variantId);
    logCartDebug('removeItem', { lineItemId: variantId, quantity: 0, handle: removed?.handle });
    if (removed) trackRemoveFromCart(removed);
    bumpCartRevision();
    set((s) => {
      const lines = s.lines.filter((l) => l.variantId !== variantId);
      if (!lines.length) {
        return {
          lines,
          shopifyCartId: null,
          checkoutUrl: null,
          shopifySubtotal: null,
          shopifyTotal: null,
          shopifyTotalTax: null,
        };
      }
      return applyOptimisticLineUpdate(lines, s);
    });
    requestDeliveryThresholdForCartEdits();
    scheduleSync();
  },

  updateQuantity: (variantId, qty) => {
    const existing = get().lines.find((l) => l.variantId === variantId);
    logCartDebug('updateQuantity', {
      lineItemId: variantId,
      quantity: qty,
      handle: existing?.handle,
    });
    cartPerfLog(
      `updateQuantity optimistic qty=${qty} shopifyLineId=${existing?.shopifyLineId ?? 'none'}`,
    );
    if (qty < 1) {
      const removed = existing;
      if (removed) trackRemoveFromCart(removed);
    }
    bumpCartRevision();
    const inventoryCapNoticeRef: {
      current: { added: number; requested: number; kind: 'set' } | null;
    } = { current: null };
    set((s) => {
      const lines =
        qty < 1
          ? s.lines.filter((l) => l.variantId !== variantId)
          : s.lines.map((l) => {
              if (l.variantId !== variantId) return l;
              const clamped = resolveClampedQty(qty, l.maxQty);
              if (clamped.capped) {
                inventoryCapNoticeRef.current = {
                  added: clamped.qty,
                  requested: qty,
                  kind: 'set',
                };
              }
              return { ...l, qty: clamped.qty };
            });
      if (!lines.length) {
        return {
          lines,
          shopifyCartId: null,
          checkoutUrl: null,
          shopifySubtotal: null,
          shopifyTotal: null,
          shopifyTotalTax: null,
        };
      }
      return applyOptimisticLineUpdate(lines, s);
    });
    const inventoryCapNotice = inventoryCapNoticeRef.current;
    if (inventoryCapNotice != null && inventoryCapNotice.added < inventoryCapNotice.requested) {
      showToast(
        inventoryLimitToast(inventoryCapNotice.added, {
          requested: inventoryCapNotice.requested,
          kind: 'set',
        }),
      );
    }
    const lineAfter = get().lines.find((l) => l.variantId === variantId);
    requestDeliveryThresholdForCartEdits();
    if (canFastPathQuantitySync(lineAfter, qty)) {
      scheduleFastQuantitySync(variantId);
    } else {
      scheduleSync();
    }
  },

  clear: () => {
    pendingFastQuantityVariantIds.clear();
    fastQuantityScheduler.cancelDebounce();
    bumpCartRevision();
    set({
      lines: [],
      shopifyCartId: null,
      checkoutUrl: null,
      shopifySubtotal: null,
      shopifyTotal: null,
      shopifyTotalTax: null,
      pendingCartSync: false,
    });
    void persistShopifyCartId(null);
    void persistCartGuestId(null);
  },
}));

/** Debounce SecureStore writes; rollback in-memory cart if persistence fails (optimistic UI). */
let persistTimer: ReturnType<typeof setTimeout> | undefined;

useCartStore.subscribe((state, prev) => {
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
        useCartStore.setState({ lines: rollback });
      }
    })();
  }, 140);
});
