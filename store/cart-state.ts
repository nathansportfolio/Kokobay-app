import { usesKokobayCartProxy, isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { trackRemoveFromCart } from '@/lib/gtm';
import { showToast } from '@/store/toast';
import type { ShopifyCartSnapshot } from '@/services/shopify/cart';
import type { CartLine } from '@/types/cart';
import { clampCartQuantity, inventoryLimitToast, resolveQuantityCap } from '@/utils/cart-inventory';
import { reconcileLinesWithSnapshotSubtotal } from '@/utils/cart-line-stock';
import {
  buildCartPricingAuditZustand,
  logCartAuditShopifyCart,
  logCartAuditZustandState,
  type CartPricingAuditRevision,
} from '@/lib/cart-pricing-audit';
import { cartSyncTrace, cartPerfLog, logCartStateTransition } from '@/lib/cart-perf-log';
import { logCartTraceWithStore } from '@/lib/cart-trace-log';
import { persistShopifyCartId, persistCartGuestId } from './cart-persist';
import {
  buildSnapshotDiscountState,
  emptyCartDiscountFields,
  notifyFirstAppOrderDiscountRetryAllowed,
} from './cart-discounts';
import {
  applyOptimisticLineUpdate,
  checkoutUrlsFromValue,
  clearCartPricingFields,
} from './cart-pricing';
import {
  cartLinesMatchVariant,
  clampCartLineQty,
  mergeCartLineMaxQty,
} from './cart-line-utils';
import type { AddToCartInput, CartState } from './cart-types';
import type { StoreApi } from 'zustand';
import { applyValidatedRemoteSnapshot } from './cart-snapshot-gateway';

/** @internal Raw Zustand commit — only the snapshot gateway should call this. */
export function createRemoteSnapshotCommit(
  set: StoreApi<CartState>['setState'],
  get: StoreApi<CartState>['getState'],
  deps: Pick<
    CartActionDeps,
    | 'getRevision'
    | 'getRevisionSnapshot'
    | 'mergeSyncedCartLines'
    | 'clearAllQuantitySyncPending'
  >,
): (snapshot: ShopifyCartSnapshot, reconciledLines?: CartLine[]) => void {
  const {
    getRevision,
    getRevisionSnapshot,
    mergeSyncedCartLines,
    clearAllQuantitySyncPending,
  } = deps;

  return (snapshot, reconciledLines) => {
    const beforeLines = get().lines.length;
    logCartStateTransition('applyRemoteSnapshot:before', beforeLines, getRevision(), {
      remoteLineCount: snapshot.lines.length,
      cartId: snapshot.cartId,
    });
    const merged =
      reconciledLines ??
      mergeSyncedCartLines(get().lines, snapshot.lines);
    const { lines, qtyReduced: subtotalQtyReduced } = reconcileLinesWithSnapshotSubtotal(
      merged,
      snapshot,
    );
    const { pricing, displayAppliedDiscounts, reservedDiscountPricing } =
      buildSnapshotDiscountState(snapshot);
    const resolvedCheckoutUrl =
      snapshot.checkoutUrl?.trim() || get().storeCheckoutUrl?.trim() || null;
    set({
      lines,
      shopifyCartId: snapshot.cartId,
      ...checkoutUrlsFromValue(resolvedCheckoutUrl),
      ...pricing,
      displayAppliedDiscounts,
      reservedDiscountPricing,
      quantitySyncPendingByVariantId: clearAllQuantitySyncPending(),
    });
    if (subtotalQtyReduced != null) {
      showToast(
        inventoryLimitToast(subtotalQtyReduced.actual, {
          requested: subtotalQtyReduced.requested,
          kind: 'set',
        }),
      );
    }
    if (__DEV__) {
      const after = get();
      logCartAuditShopifyCart(snapshot, {
        origin: usesKokobayCartProxy() ? 'kokobay_api' : 'shopify_graphql',
        lines: after.lines,
      });
      logCartAuditZustandState(
        buildCartPricingAuditZustand({
          revision: getRevisionSnapshot(),
          lines: after.lines,
          marketCurrency: after.lines[0]?.unitPrice?.currencyCode ?? 'GBP',
          shopifySubtotal: after.shopifySubtotal,
          shopifyTotal: after.shopifyTotal,
          shopifyTotalTax: after.shopifyTotalTax,
          shopifyLineMerchandiseSubtotal: after.shopifyLineMerchandiseSubtotal,
          shopifyLineMerchandiseTotal: after.shopifyLineMerchandiseTotal,
          shopifyCartDiscountAmount: after.shopifyCartDiscountAmount,
          shopifyDiscountCodes: after.shopifyDiscountCodes,
          reservedDiscountPricing: after.reservedDiscountPricing,
          pendingCartSync: after.pendingCartSync,
          isSyncingShopify: after.isSyncingShopify,
          displayAppliedDiscounts: after.displayAppliedDiscounts,
        }),
      );
    }
    void persistShopifyCartId(snapshot.cartId);
    notifyFirstAppOrderDiscountRetryAllowed(get);
    logCartTraceWithStore('apply_remote_snapshot', {
      cartId: snapshot.cartId,
      beforeLines,
      remoteLineCount: snapshot.lines.length,
      checkoutUrl: resolvedCheckoutUrl,
    });
    logCartStateTransition('applyRemoteSnapshot:after', get().lines.length, getRevision(), {
      beforeLines,
      remoteLineCount: snapshot.lines.length,
    });
  };
}

function resolveClampedQty(
  requestedQty: number,
  maxQty: number | undefined,
): { qty: number; capped: boolean; cap?: number } {
  const { qty, capped } = clampCartQuantity(requestedQty, maxQty);
  return capped && maxQty != null ? { qty, capped, cap: maxQty } : { qty, capped: false };
}

function logCartDebug(
  action: string,
  details: { lineItemId?: string; quantity?: number; handle?: string },
): void {
  logCartTraceWithStore('local_mutation', {
    action,
    variantId: details.lineItemId ?? null,
    quantity: details.quantity,
    handle: details.handle ?? null,
  });
}

function emptyLineClearState(lines: CartLine[]) {
  return {
    lines,
    shopifyCartId: null,
    ...checkoutUrlsFromValue(null),
    ...clearCartPricingFields(),
    ...emptyCartDiscountFields(),
  };
}

export type CartActionDeps = {
  getRevision: () => number;
  bumpRevision: (source: string) => void;
  scheduleSync: (source: string) => void;
  scheduleFastAddSync: (variantId: string) => void;
  flushFastQuantitySyncForVariant: (variantId: string) => void;
  scheduleDebouncedQuantitySync: (variantId: string) => void;
  cancelQtyChangeSyncTimer: (variantId: string) => void;
  clearAllQuantitySyncPending: () => Record<string, true>;
  mergeSyncedCartLines: (
    local: CartLine[],
    remote: CartLine[],
    options?: { dropLinesMissingOnRemote?: boolean; learnInventoryCap?: boolean },
  ) => CartLine[];
  markQuantitySyncPending: (pending: Record<string, true>, variantId: string) => Record<string, true>;
  cartSyncScheduler: { cancelDebounce: () => void };
  pendingFastQuantityVariantIds: Set<string>;
  pendingFastAddVariantIds: Set<string>;
  getRevisionSnapshot: () => CartPricingAuditRevision;
};

export function createCartStoreActions(
  set: StoreApi<CartState>['setState'],
  get: StoreApi<CartState>['getState'],
  deps: CartActionDeps,
): Pick<
  CartState,
  | 'addToCart'
  | 'addToBag'
  | 'removeItem'
  | 'updateQuantity'
  | 'nudgeCartLineQuantity'
  | 'clear'
  | 'applyRemoteSnapshot'
> {
  const {
    getRevision,
    bumpRevision,
    scheduleSync,
    scheduleFastAddSync,
    flushFastQuantitySyncForVariant,
    scheduleDebouncedQuantitySync,
    cancelQtyChangeSyncTimer,
    clearAllQuantitySyncPending,
    mergeSyncedCartLines,
    markQuantitySyncPending,
    cartSyncScheduler,
    pendingFastQuantityVariantIds,
    pendingFastAddVariantIds,
    getRevisionSnapshot,
  } = deps;

  return {
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
        const safeQty = clampCartLineQty(qty);
        const catalogCap = resolveQuantityCap(quantityAvailable);
        logCartDebug('addToCart', { lineItemId: variantId, quantity: safeQty, handle });
        const wasEmpty = get().lines.length === 0;
        const existing = get().lines.find(
          (l) => l.handle === handle && cartLinesMatchVariant(l, variantId),
        );
        const isNewLine = !existing;
        const hadShopifyLineId = Boolean(existing?.shopifyLineId?.trim());
        bumpRevision('add_to_cart');
        const snapshot = {
          ...(title !== undefined ? { title } : {}),
          ...(variantTitle !== undefined ? { variantTitle } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        } satisfies Partial<Pick<CartLine, 'title' | 'variantTitle' | 'imageUrl'>>;
        const priceSnapshot =
          unitPrice !== undefined
            ? { unitPrice, listUnitPrice: unitPrice }
            : ({} as Partial<Pick<CartLine, 'unitPrice' | 'listUnitPrice'>>);
        let inventoryCapNotice: {
          added: number;
          requested: number;
          kind: 'add' | 'max';
        } | null = null;
        set((s) => {
          const idx = s.lines.findIndex(
            (l) => l.handle === handle && cartLinesMatchVariant(l, variantId),
          );
          const lines =
            idx >= 0
              ? s.lines.map((l, i) => {
                  if (i !== idx) return l;
                  const maxQty = mergeCartLineMaxQty(l.maxQty, catalogCap);
                  const rawNext = clampCartLineQty(l.qty + safeQty);
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
                    ...(unitPrice !== undefined
                      ? { unitPrice, listUnitPrice: l.listUnitPrice ?? unitPrice }
                      : priceSnapshot),
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
                  return [...s.lines, { handle, variantId, qty: clamped.qty, maxQty, ...snapshot, ...priceSnapshot }];
                })();
          return applyOptimisticLineUpdate(lines, s, { markQuantitySyncPending });
        });
        if (inventoryCapNotice != null) {
          const { added, requested, kind } = inventoryCapNotice;
          if (kind === 'add' && added > 0 && added < requested) {
            showToast({ ...inventoryLimitToast(added, { requested, kind: 'add' }), position: 'bottom' });
          } else if (added < requested) {
            showToast(inventoryLimitToast(added, { kind: 'max' }));
          }
        }
        if (wasEmpty) {
          notifyFirstAppOrderDiscountRetryAllowed(get);
        }
        if (!isRemoteCartConfigured()) return;
    
        if (!isNewLine && hadShopifyLineId) {
          cartSyncTrace('add_to_cart_fast_patch', { variantId, isNewLine, hadShopifyLineId });
          flushFastQuantitySyncForVariant(variantId);
          return;
        }
    
        if (isNewLine && usesKokobayCartProxy()) {
          cartSyncTrace('add_to_cart_fast_post', { variantId, isNewLine, hadShopifyLineId });
          scheduleFastAddSync(variantId);
          return;
        }
    
        scheduleSync(
          !isNewLine && !hadShopifyLineId
            ? 'add_to_cart:missing_shopify_line_id'
            : 'add_to_cart:shopify_graphql',
        );
      },
    
      addToBag: (params) => {
        get().addToCart(params);
      },
    
      removeItem: (variantId) => {
        const removed = get().lines.find((l) => cartLinesMatchVariant(l, variantId));
        logCartDebug('removeItem', { lineItemId: variantId, quantity: 0, handle: removed?.handle });
        if (removed) trackRemoveFromCart(removed);
        bumpRevision('remove_item');
        set((s) => {
          const lines = s.lines.filter((l) => !cartLinesMatchVariant(l, variantId));
          if (!lines.length) {
        return emptyLineClearState(lines);
      }
          return applyOptimisticLineUpdate(lines, s, { quantitySyncVariantId: variantId, markQuantitySyncPending });
        });
        if (!get().lines.length) {
          notifyFirstAppOrderDiscountRetryAllowed(get);
        }
        scheduleSync('remove_item');
      },
    
      updateQuantity: (variantId, qty) => {
        const existing = get().lines.find((l) => cartLinesMatchVariant(l, variantId));
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
        bumpRevision('update_quantity');
        const inventoryCapNoticeRef: {
          current: { added: number; requested: number; kind: 'set' } | null;
        } = { current: null };
        set((s) => {
          const lines =
            qty < 1
              ? s.lines.filter((l) => !cartLinesMatchVariant(l, variantId))
              : s.lines.map((l) => {
                  if (!cartLinesMatchVariant(l, variantId)) return l;
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
        return emptyLineClearState(lines);
      }
          return applyOptimisticLineUpdate(lines, s, { markQuantitySyncPending });
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
        if (!get().lines.length) {
          notifyFirstAppOrderDiscountRetryAllowed(get);
        }
        if (qty < 1) {
          cancelQtyChangeSyncTimer(variantId);
          scheduleSync('update_quantity:removed');
          return;
        }
        scheduleDebouncedQuantitySync(variantId);
      },
    
      nudgeCartLineQuantity: (variantId, delta) => {
        if (delta === 0) return;
        const existing = get().lines.find((l) => cartLinesMatchVariant(l, variantId));
        if (!existing) return;
        const nextQty = existing.qty + delta;
        if (delta < 0 && nextQty < 1) {
          get().removeItem(variantId);
          return;
        }
        get().updateQuantity(variantId, nextQty);
      },
    
      applyRemoteSnapshot: (snapshot, reconciledLines) => {
        applyValidatedRemoteSnapshot(snapshot, {
          reconciledLines,
          source: 'store_applyRemoteSnapshot',
        });
      },
    
      clear: () => {
        logCartStateTransition('clear:before', get().lines.length, getRevision());
        pendingFastQuantityVariantIds.clear();
        pendingFastAddVariantIds.clear();
        cartSyncScheduler.cancelDebounce();
        bumpRevision('clear');
        set({
          ...emptyLineClearState([]),
          pendingCartSync: false,
          quantitySyncPendingByVariantId: clearAllQuantitySyncPending(),
        });
        void persistShopifyCartId(null);
        void persistCartGuestId(null);
        notifyFirstAppOrderDiscountRetryAllowed(get);
        logCartStateTransition('clear:after', 0, getRevision());
      },
  };
}
