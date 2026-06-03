import { create } from 'zustand';
import { AppState } from 'react-native';

import type { ShopifyCartSnapshot } from '@/services/shopify/cart';
import { isRemoteCartConfigured, usesKokobayCartProxy } from '@/services/cart/remote-cart';
import { clearRemoteKokobayCart, fetchRemoteCartCheckoutUrl } from '@/services/kokobay-web/cart';
import {
  patchCartQuantityFast,
  postCartAddLineFast,
  syncLocalCartToRemote,
} from '@/services/cart/sync';
import { cartCoalesceLog } from '@/lib/cart-coalesce-log';
import { recordForegroundAuditCart } from '@/lib/foreground-audit';
import { recordHydration } from '@/lib/lifecycle-perf';
import {
  cartPerfLog,
  cartResumeSyncCompleted,
  cartResumeSyncEvaluated,
  cartResumeSyncSkipped,
  cartResumeSyncStarted,
  cartSyncTrace,
  logCartStateTransition,
  logCartSyncRevisionState,
  logFastAddSuccess,
  noteUnexpectedFullSyncAfterFastAdd,
} from '@/lib/cart-perf-log';
import {
  decideCartForegroundResumeSync,
  type CartResumeSyncDecision,
} from '@/store/cart-resume-sync';
import { reportOperationalFailure } from '@/lib/appErrorLog';
import { trackRemoveFromCart } from '@/lib/gtm';
import { showToast } from '@/store/toast';
import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';
import { clampCartQuantity, inventoryLimitToast, resolveQuantityCap } from '@/utils/cart-inventory';
import { getDeliveryThresholdGbpSync } from '@/services/delivery-threshold';
import {
  computeCartSubtotal,
  computeEstimatedTotal,
  computeShippingEstimate,
} from '@/utils/cart-totals';
import { hasCartLinePricing } from '@/utils/cart-line-pricing';
import { reconcileLinesWithSnapshotSubtotal } from '@/utils/cart-line-stock';
import { cartSyncErrorToast } from '@/utils/cart-sync-messages';
import {
  buildCartPricingAuditZustand,
  logCartAuditOptimisticUpdate,
  logCartAuditPricingSelector,
  logCartAuditShopifyCart,
  logCartAuditZustandState,
  type CartPricingAuditRevision,
} from '@/lib/cart-pricing-audit';
import {
  deriveAppliedDiscountsFromCart,
  type CartAppliedDiscount,
} from '@/utils/cart-cost-breakdown';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';
import { CART_SYNC_DEBOUNCE_MS, createCartSyncScheduler } from './cart-sync-scheduler';
import { logAppFirstOrder } from '@/services/cart/app-first-order-log';
import {
  clearFirstAppOrderDiscountApplySettled,
  isFirstAppOrderDiscountApplySettled,
} from '@/services/cart/first-order-discount-settled';
import { getIsFirstAppOrderSync, scheduleAppBenefitsRefreshOnCartChange } from './app-benefits';
import {
  cartLineMissingPersistedDisplay,
  loadCartGuestId,
  loadPersistedCart,
  loadShopifyCartId,
  persistCartGuestId,
  persistCartLines,
  persistShopifyCartId,
} from './cart-persist';

function cartLinesMatchVariant(line: CartLine, variantId: string): boolean {
  return shopifyVariantKey(line.variantId) === shopifyVariantKey(variantId);
}

export type { CartDiscountCode } from '@/types/cart';

export type ReservedCartPricing = {
  shopifySubtotal: Money;
  shopifyTotal: Money;
  shopifyTotalTax: Money | null;
  shopifyDiscountCodes: CartDiscountCode[];
  shopifyCartDiscountAmount: Money | null;
  shopifyLineMerchandiseSubtotal: Money | null;
  shopifyLineMerchandiseTotal: Money | null;
};

function cartDiscountAmountValue(amount: Money | null | undefined): number {
  if (amount?.amount == null || String(amount.amount).trim() === '') return 0;
  const value = Number.parseFloat(String(amount.amount));
  return Number.isFinite(value) ? value : 0;
}

function pickDiscountAmount(
  primary: Money | null | undefined,
  secondary: Money | null | undefined,
): Money | undefined {
  const primaryN = cartDiscountAmountValue(primary);
  const secondaryN = cartDiscountAmountValue(secondary);
  if (primaryN <= 0.005 && secondaryN <= 0.005) return undefined;
  if (secondaryN > primaryN && secondary) return secondary;
  return primary ?? secondary ?? undefined;
}

function mergeCartDiscountCodes(
  primary: CartDiscountCode[],
  secondary: CartDiscountCode[],
): CartDiscountCode[] {
  const byCode = new Map<string, CartDiscountCode>();
  for (const entry of [...secondary, ...primary]) {
    const key = entry.code.trim().toUpperCase();
    if (!key) continue;
    const prev = byCode.get(key);
    byCode.set(key, {
      code: entry.code,
      applicable: entry.applicable,
      amount: pickDiscountAmount(entry.amount, prev?.amount),
    });
  }
  return [...byCode.values()];
}

function hasCartDiscountCodes(discountCodes: CartDiscountCode[]): boolean {
  return discountCodes.some((entry) => entry.code.trim());
}

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

/** Debounced remote sync for +/- qty (optimistic qty is still immediate). */
const qtyChangeSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

function markQuantitySyncPending(
  pending: Record<string, true>,
  variantId: string,
): Record<string, true> {
  const key = variantId.trim();
  if (!key || pending[key]) return pending;
  return { ...pending, [key]: true };
}

function clearAllQuantitySyncPending(): Record<string, true> {
  return {};
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
        listUnitPrice: prev.listUnitPrice ?? l.listUnitPrice ?? prev.unitPrice ?? l.unitPrice,
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
      listUnitPrice: line.listUnitPrice ?? line.unitPrice,
      unitPrice: synced.unitPrice ?? line.unitPrice,
    };
    if (synced.qty < line.qty || options?.learnInventoryCap) {
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
  /** Shopify Storefront checkoutUrl from cart sync — preferred checkout entry. */
  checkoutUrl: string | null;
  /** Alias for checkoutUrl (same value) — used in checkout logs and guards. */
  storeCheckoutUrl: string | null;
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  shopifyTotalTax: Money | null;
  shopifyDiscountCodes: CartDiscountCode[];
  shopifyCartDiscountAmount: Money | null;
  shopifyLineMerchandiseSubtotal: Money | null;
  shopifyLineMerchandiseTotal: Money | null;
  reservedDiscountPricing: ReservedCartPricing | null;
  displayAppliedDiscounts: CartAppliedDiscount[];
  isSyncingShopify: boolean;
  pendingCartSync: boolean;
  /** Line variant ids with a qty mutation awaiting remote cart pricing. */
  quantitySyncPendingByVariantId: Record<string, true>;
  hasHydrated: boolean;
  hydrate: () => Promise<void>;
  syncWithShopify: (customerEmail?: string) => Promise<void>;
  addToCart: (params: AddToCartInput) => void;
  /** @deprecated use addToCart */
  addToBag: (params: AddToCartInput) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, qty: number) => void;
  /** +/- stepper — reads latest qty from store so rapid taps debounce correctly. */
  nudgeCartLineQuantity: (variantId: string, delta: number) => void;
  clear: () => void;
  applyRemoteSnapshot: (snapshot: ShopifyCartSnapshot, reconciledLines?: CartLine[]) => void;
};

export type CartPricingForDisplay = {
  shopifySubtotal: Money | null;
  shopifyTotal: Money | null;
  shopifyTotalTax: Money | null;
  shopifyDiscountCodes: CartDiscountCode[];
  shopifyCartDiscountAmount: Money | null;
  shopifyLineMerchandiseSubtotal: Money | null;
  shopifyLineMerchandiseTotal: Money | null;
};

type CartPricingForDisplayState = Pick<
  CartState,
  | 'shopifySubtotal'
  | 'shopifyTotal'
  | 'shopifyTotalTax'
  | 'shopifyDiscountCodes'
  | 'shopifyCartDiscountAmount'
  | 'shopifyLineMerchandiseSubtotal'
  | 'shopifyLineMerchandiseTotal'
  | 'reservedDiscountPricing'
  | 'pendingCartSync'
  | 'isSyncingShopify'
  | 'quantitySyncPendingByVariantId'
>;

function hasQuantitySyncPending(
  pending: Record<string, true>,
): boolean {
  return Object.keys(pending).length > 0;
}

let cartPricingForDisplayCache: CartPricingForDisplay | null = null;

function moneyEqual(a: Money | null | undefined, b: Money | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.amount === b.amount && a.currencyCode === b.currencyCode;
}

function discountCodesEqual(a: CartDiscountCode[], b: CartDiscountCode[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left.code !== right.code || left.applicable !== right.applicable) return false;
    if (!moneyEqual(left.amount, right.amount)) return false;
  }
  return true;
}

function cartPricingForDisplayEqual(a: CartPricingForDisplay, b: CartPricingForDisplay): boolean {
  return (
    moneyEqual(a.shopifySubtotal, b.shopifySubtotal) &&
    moneyEqual(a.shopifyTotal, b.shopifyTotal) &&
    moneyEqual(a.shopifyTotalTax, b.shopifyTotalTax) &&
    discountCodesEqual(a.shopifyDiscountCodes, b.shopifyDiscountCodes) &&
    moneyEqual(a.shopifyCartDiscountAmount, b.shopifyCartDiscountAmount) &&
    moneyEqual(a.shopifyLineMerchandiseSubtotal, b.shopifyLineMerchandiseSubtotal) &&
    moneyEqual(a.shopifyLineMerchandiseTotal, b.shopifyLineMerchandiseTotal)
  );
}

/** Keep last API discount pricing visible while cart sync is in flight. */
function computeCartPricingForDisplay(
  state: CartPricingForDisplayState,
): { pricing: CartPricingForDisplay; selectorPath: 'reserved_during_sync' | 'live_state' } {
  const qtySyncPending = hasQuantitySyncPending(state.quantitySyncPendingByVariantId);
  if (
    (state.pendingCartSync || state.isSyncingShopify) &&
    state.reservedDiscountPricing &&
    !qtySyncPending
  ) {
    const reserved = state.reservedDiscountPricing;
    return {
      selectorPath: 'reserved_during_sync',
      pricing: {
        ...reserved,
        shopifyDiscountCodes: mergeCartDiscountCodes(
          state.shopifyDiscountCodes,
          reserved.shopifyDiscountCodes,
        ),
        shopifyCartDiscountAmount:
          pickDiscountAmount(state.shopifyCartDiscountAmount, reserved.shopifyCartDiscountAmount) ??
          state.shopifyCartDiscountAmount ??
          reserved.shopifyCartDiscountAmount ??
          null,
      },
    };
  }
  return {
    selectorPath: 'live_state',
    pricing: {
      shopifySubtotal: state.shopifySubtotal,
      shopifyTotal: state.shopifyTotal,
      shopifyTotalTax: state.shopifyTotalTax,
      shopifyDiscountCodes: state.shopifyDiscountCodes,
      shopifyCartDiscountAmount: state.shopifyCartDiscountAmount,
      shopifyLineMerchandiseSubtotal: state.shopifyLineMerchandiseSubtotal,
      shopifyLineMerchandiseTotal: state.shopifyLineMerchandiseTotal,
    },
  };
}

let lastCartPricingSelectorAuditKey = '';

function auditCartPricingSelector(
  state: CartPricingForDisplayState,
  next: CartPricingForDisplay,
  selectorPath: 'reserved_during_sync' | 'live_state',
): void {
  if (!__DEV__) return;
  const auditKey = [
    selectorPath,
    state.pendingCartSync,
    state.isSyncingShopify,
    state.shopifySubtotal?.amount,
    state.shopifyTotal?.amount,
    state.reservedDiscountPricing?.shopifySubtotal?.amount,
    next.shopifySubtotal?.amount,
    next.shopifyTotal?.amount,
  ].join('|');
  if (auditKey === lastCartPricingSelectorAuditKey) return;
  lastCartPricingSelectorAuditKey = auditKey;

  logCartAuditPricingSelector({
    revision: getCartRevisionSnapshot(),
    pendingCartSync: state.pendingCartSync,
    isSyncingShopify: state.isSyncingShopify,
    hasReservedDiscountPricing: Boolean(state.reservedDiscountPricing),
    raw: {
      shopifySubtotal: state.shopifySubtotal,
      shopifyTotal: state.shopifyTotal,
      shopifyTotalTax: state.shopifyTotalTax,
      shopifyLineMerchandiseSubtotal: state.shopifyLineMerchandiseSubtotal,
      shopifyLineMerchandiseTotal: state.shopifyLineMerchandiseTotal,
    },
    reserved: state.reservedDiscountPricing
      ? {
          shopifySubtotal: state.reservedDiscountPricing.shopifySubtotal,
          shopifyTotal: state.reservedDiscountPricing.shopifyTotal,
        }
      : null,
    output: next,
    selectorPath,
  });
}

/**
 * Derived cart pricing for the bag screen. Returns a stable object reference when values
 * are unchanged so React 19 / useSyncExternalStore do not loop on new snapshots.
 */
const lineQuantityPricePendingSelectorCache = new Map<
  string,
  (state: Pick<CartState, 'quantitySyncPendingByVariantId'>) => boolean
>();

export function selectIsLineQuantityPricePending(variantId: string) {
  const key = variantId.trim();
  if (!key) {
    return (state: Pick<CartState, 'quantitySyncPendingByVariantId'>) => false;
  }
  let selector = lineQuantityPricePendingSelectorCache.get(key);
  if (!selector) {
    selector = (state) => Boolean(state.quantitySyncPendingByVariantId[key]);
    lineQuantityPricePendingSelectorCache.set(key, selector);
  }
  return selector;
}

/** True while a qty change is awaiting confirmed line/checkout pricing (not login cart merge). */
export function selectIsCartCheckoutPricingPending(
  state: Pick<CartState, 'quantitySyncPendingByVariantId'>,
): boolean {
  return Object.keys(state.quantitySyncPendingByVariantId).length > 0;
}

export function selectCartPricingForDisplay(state: CartPricingForDisplayState): CartPricingForDisplay {
  const { pricing: next, selectorPath } = computeCartPricingForDisplay(state);
  if (cartPricingForDisplayCache && cartPricingForDisplayEqual(cartPricingForDisplayCache, next)) {
    return cartPricingForDisplayCache;
  }
  auditCartPricingSelector(state, next, selectorPath);
  cartPricingForDisplayCache = next;
  return next;
}

let cartRevision = 0;
/** Revision last successfully pushed to Shopify — skips no-op syncs on resume. */
let lastSyncedRevision = 0;

export function getCartRevisionSnapshot(): CartPricingAuditRevision {
  return {
    cartRevision,
    lastSyncedRevision,
    isCartDirty: cartRevision !== lastSyncedRevision,
  };
}
/** Timestamp of last successful remote sync (revision matched). */
let lastSuccessfulCartSyncAtMs = 0;
let forceNextSync = false;
let activeSyncGeneration = 0;
/** Variant ids queued for debounced PATCH-only quantity sync (Koko Bay proxy). */
const pendingFastQuantityVariantIds = new Set<string>();
/** Variant ids queued for POST /api/cart/items — new lines without `shopifyLineId`. */
const pendingFastAddVariantIds = new Set<string>();

type CartNetworkSyncKind = 'full' | 'fast' | 'fast_add';

let cartNetworkChain: Promise<void> = Promise.resolve();
let cartNetworkQueueDepth = 0;
let cartNetworkMaxQueueDepth = 0;
let cartSyncRunnerInFlight = false;
let cartSyncFollowUpPending = false;
let cartNetworkSyncInFlight: Promise<void> | null = null;
let debounceRevisionBaseline = 0;
let debounceCoalescedUpdates = 0;
let cartSyncCount = 0;
let cartSyncTotalDurationMs = 0;

/** Auth/login flush deferred until SecureStore cart hydrate completes. */
let pendingFlushCustomerEmailAfterHydrate: string | undefined;
/** Login merge — keep guest lines even when remote reconcile fails or local read races. */
let preserveLocalCartLinesThisSync = false;

function logCartHydrationGate(syncAllowed: boolean, reason: string): void {
  if (!__DEV__) return;
  const { hasHydrated } = useCartStore.getState();
  console.log(
    `[CART_HYDRATION_GATE] hasHydrated=${hasHydrated} syncAllowed=${syncAllowed} reason=${reason}`,
  );
}

function skipCartSyncUntilHydrated(caller: string): boolean {
  if (useCartStore.getState().hasHydrated) {
    return false;
  }
  console.log('[CART_SYNC_SKIPPED]', 'waiting_for_hydration');
  logCartHydrationGate(false, caller);
  return true;
}

function finishCartHydrationPostSync(): void {
  logCartHydrationGate(true, 'hydrate_complete');
  const pendingEmail = pendingFlushCustomerEmailAfterHydrate;
  pendingFlushCustomerEmailAfterHydrate = undefined;

  if (pendingEmail && useCartStore.getState().lines.length > 0) {
    void mergeGuestCartOnLogin(pendingEmail);
    return;
  }

  if (isRemoteCartConfigured() && isCartDirty()) {
    scheduleSync('hydrate_post:dirty');
  }
}

function enqueueCartNetwork(task: () => Promise<void>): Promise<void> {
  cartNetworkQueueDepth += 1;
  cartNetworkMaxQueueDepth = Math.max(cartNetworkMaxQueueDepth, cartNetworkQueueDepth);
  const run = cartNetworkChain
    .then(async () => {
      try {
        await task();
      } finally {
        cartNetworkQueueDepth = Math.max(0, cartNetworkQueueDepth - 1);
      }
    });
  cartNetworkChain = run.catch(() => {});
  return run;
}

function noteSyncScheduled(): void {
  if (cartSyncScheduler.isDebouncePending()) {
    const delta = cartRevision - debounceRevisionBaseline;
    if (delta > 0) {
      debounceCoalescedUpdates += delta;
    }
  } else {
    debounceRevisionBaseline = cartRevision;
    debounceCoalescedUpdates = 0;
  }
}

function recordCartSyncSuccess(): void {
  lastSuccessfulCartSyncAtMs = Date.now();
}

function cartResumeSyncLogPayload(
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    isCartDirty: isCartDirty(),
    cartRevision,
    lastSyncedRevision,
    lastSyncAgeMs:
      lastSuccessfulCartSyncAtMs > 0 ? Date.now() - lastSuccessfulCartSyncAtMs : null,
    ...extra,
  };
}

function hasPendingLocalCartMutations(): boolean {
  const state = useCartStore.getState();
  return (
    state.pendingCartSync ||
    state.isSyncingShopify ||
    pendingFastQuantityVariantIds.size > 0 ||
    Object.keys(state.quantitySyncPendingByVariantId).length > 0 ||
    cartSyncScheduler.isDebouncePending()
  );
}

function buildCartForegroundResumeDecision(): CartResumeSyncDecision {
  return decideCartForegroundResumeSync({
    isCartDirty: isCartDirty(),
    cartRevision,
    lastSyncedRevision,
    lastSyncAgeMs:
      lastSuccessfulCartSyncAtMs > 0 ? Date.now() - lastSuccessfulCartSyncAtMs : null,
    hasPendingMutations: hasPendingLocalCartMutations(),
  });
}

function applyForegroundResumeSkipSideEffects(reason: string): void {
  if (reason !== 'stale_pending_flags_recently_synced') return;
  cartSyncScheduler.cancelDebounce();
  finalizePendingCartSync();
}

let cachedForegroundResumeGate: boolean | null = null;
let cachedForegroundResumeGateMs = 0;

function shouldForegroundResumeCartSync(): boolean {
  const now = Date.now();
  if (cachedForegroundResumeGate !== null && now - cachedForegroundResumeGateMs < 250) {
    return cachedForegroundResumeGate;
  }

  const decision = buildCartForegroundResumeDecision();
  cartResumeSyncEvaluated({
    ...cartResumeSyncLogPayload(),
    reason: decision.reason,
    skip: decision.skip,
    hasPendingMutations: decision.hasPendingMutations,
  });

  if (decision.skip) {
    applyForegroundResumeSkipSideEffects(decision.reason);
    cartResumeSyncSkipped({
      ...cartResumeSyncLogPayload(),
      reason: decision.reason,
    });
    cachedForegroundResumeGate = false;
    cachedForegroundResumeGateMs = now;
    return false;
  }

  if (!isCartDirty()) {
    cartResumeSyncSkipped({
      ...cartResumeSyncLogPayload(),
      reason: 'should_sync_false',
    });
    cachedForegroundResumeGate = false;
    cachedForegroundResumeGateMs = now;
    return false;
  }

  cachedForegroundResumeGate = true;
  cachedForegroundResumeGateMs = now;
  return true;
}

async function runCartNetworkSyncBody(
  kind: CartNetworkSyncKind,
  customerEmail?: string,
): Promise<void> {
  cartSyncRunnerInFlight = true;
  let passes = 0;

  try {
    do {
      passes += 1;
      if (passes > 4) break;

      if (debounceCoalescedUpdates > 0) {
        cartCoalesceLog(`coalesced ${debounceCoalescedUpdates} updates`);
        debounceCoalescedUpdates = 0;
        debounceRevisionBaseline = cartRevision;
      }

      cartSyncFollowUpPending = false;
      const syncStart = performance.now();
      cartResumeSyncStarted({
        ...cartResumeSyncLogPayload(),
        kind,
        coalesced: debounceCoalescedUpdates,
      });

      if (kind === 'fast_add') {
        await syncAddFast(customerEmail);
      } else if (kind === 'fast') {
        await syncQuantityFast(customerEmail);
      } else {
        await useCartStore.getState().syncWithShopify(customerEmail);
      }

      const durationMs = Math.round(performance.now() - syncStart);
      cartCoalesceLog(`sync duration ${durationMs}ms`);
      cartResumeSyncCompleted({
        ...cartResumeSyncLogPayload(),
        kind,
        duration_ms: durationMs,
      });
      cartSyncCount += 1;
      cartSyncTotalDurationMs += durationMs;

      if (cartSyncFollowUpPending && isCartDirty()) {
        cartCoalesceLog('pending sync detected');
        cartSyncTrace('follow_up_full_sync', {
          reason: 'cartSyncFollowUpPending_and_dirty',
          cartRevision,
          lastSyncedRevision,
          priorKind: kind,
        });
        kind = 'full';
        continue;
      }
      break;
    } while (true);
  } finally {
    cartSyncRunnerInFlight = false;
  }
}

async function runCartNetworkSync(
  kind: CartNetworkSyncKind,
  customerEmail?: string,
): Promise<void> {
  if (skipCartSyncUntilHydrated(`runCartNetworkSync:${kind}`)) return;

  for (;;) {
    if (cartNetworkSyncInFlight) {
      cartCoalesceLog('await in-flight cart sync');
      await cartNetworkSyncInFlight;
      if (!isCartDirty()) return;
      cartCoalesceLog('cart still dirty after in-flight sync — running follow-up');
      cartSyncTrace('follow_up_full_sync', {
        reason: 'dirty_after_in_flight_sync',
        cartRevision,
        lastSyncedRevision,
        priorKind: kind,
      });
      kind = 'full';
      continue;
    }

    const run = runCartNetworkSyncBody(kind, customerEmail);
    cartNetworkSyncInFlight = run;
    try {
      await run;
    } finally {
      if (cartNetworkSyncInFlight === run) {
        cartNetworkSyncInFlight = null;
      }
    }
    return;
  }
}

/** @internal diagnostics for cart sync audits */
export function getCartNetworkSyncMetrics(): {
  maxQueueDepth: number;
  currentQueueDepth: number;
  totalSyncs: number;
  avgSyncDurationMs: number;
} {
  return {
    maxQueueDepth: cartNetworkMaxQueueDepth,
    currentQueueDepth: cartNetworkQueueDepth,
    totalSyncs: cartSyncCount,
    avgSyncDurationMs:
      cartSyncCount > 0 ? Math.round(cartSyncTotalDurationMs / cartSyncCount) : 0,
  };
}

function isCartDirty(): boolean {
  return cartRevision !== lastSyncedRevision;
}

function isCartSyncPending(): boolean {
  return (
    cartSyncScheduler.isDebouncePending() ||
    pendingFastQuantityVariantIds.size > 0 ||
    pendingFastAddVariantIds.size > 0
  );
}

function resolveCartSyncKind(caller: string): CartNetworkSyncKind {
  let kind: CartNetworkSyncKind = 'full';
  if (isCartDirty()) {
    if (pendingFastAddVariantIds.size > 0) {
      kind = 'fast_add';
    } else if (pendingFastQuantityVariantIds.size > 0) {
      kind = 'fast';
    }
  }

  if (kind === 'full') {
    noteUnexpectedFullSyncAfterFastAdd(caller, {
      isCartDirty: isCartDirty(),
      cartRevision,
      lastSyncedRevision,
      debouncePending: cartSyncScheduler.isDebouncePending(),
    });
  }

  cartSyncTrace('resolve_cart_sync_kind', {
    caller,
    kind,
    pendingFastAddCount: pendingFastAddVariantIds.size,
    pendingFastAddVariantIds: [...pendingFastAddVariantIds],
    pendingFastQuantityCount: pendingFastQuantityVariantIds.size,
    pendingFastVariantIds: [...pendingFastQuantityVariantIds],
    isCartDirty: isCartDirty(),
    cartRevision,
    lastSyncedRevision,
  });
  return kind;
}

/** Single debounce queue + one AppState listener for foreground resume. */
const cartSyncScheduler = createCartSyncScheduler(
  async (customerEmail) => {
    await enqueueCartNetwork(() =>
      runCartNetworkSync(resolveCartSyncKind('cart_sync_scheduler'), customerEmail),
    );
  },
  {
    shouldSync: isCartDirty,
    shouldForegroundResume: shouldForegroundResumeCartSync,
    debounceMs: CART_SYNC_DEBOUNCE_MS,
    lifecycleListenerId: 'cart-sync-scheduler',
  },
);

function finalizePendingCartSync(): void {
  const { isSyncingShopify } = useCartStore.getState();
  if (!isSyncingShopify && !isCartSyncPending()) {
    useCartStore.setState({
      pendingCartSync: false,
      quantitySyncPendingByVariantId: clearAllQuantitySyncPending(),
    });
  }
}

function scheduleSync(source: string): void {
  const { lines, hasHydrated } = useCartStore.getState();
  logCartStateTransition(source, lines.length, cartRevision, {
    phase: 'scheduleSync_called',
    hasHydrated,
    isCartDirty: isCartDirty(),
    lastSyncedRevision,
  });
  cartSyncTrace('schedule_sync_called', {
    source,
    isCartDirty: isCartDirty(),
    cartRevision,
    lastSyncedRevision,
    debouncePending: cartSyncScheduler.isDebouncePending(),
  });
  if (skipCartSyncUntilHydrated(`scheduleSync:${source}`)) return;
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  noteSyncScheduled();
  if (!cartSyncRunnerInFlight) {
    pendingFastQuantityVariantIds.clear();
    pendingFastAddVariantIds.clear();
  }
  useCartStore.setState({ pendingCartSync: true });
  cartSyncScheduler.scheduleSync();
}

function scheduleFastAddSync(variantId: string): void {
  if (skipCartSyncUntilHydrated('scheduleFastAddSync')) return;
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  const key = variantId.trim();
  if (!key) return;
  noteSyncScheduled();
  pendingFastAddVariantIds.add(key);
  useCartStore.setState({ pendingCartSync: true });
  cartSyncScheduler.cancelDebounce();
  void cartSyncScheduler.flushSync();
}

function flushFastQuantitySyncForVariant(variantId: string): void {
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  const key = variantId.trim();
  if (!key) return;
  noteSyncScheduled();
  pendingFastAddVariantIds.delete(key);
  pendingFastQuantityVariantIds.add(key);
  useCartStore.setState({ pendingCartSync: true });
  cartSyncScheduler.cancelDebounce();
  void cartSyncScheduler.flushSync();
}

function scheduleFastQuantitySync(variantId: string): void {
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  noteSyncScheduled();
  pendingFastQuantityVariantIds.add(variantId);
  useCartStore.setState({ pendingCartSync: true });
  cartSyncScheduler.scheduleSync();
}

function cancelQtyChangeSyncTimer(variantId: string): void {
  const key = variantId.trim();
  const timer = qtyChangeSyncTimers.get(key);
  if (timer) clearTimeout(timer);
  qtyChangeSyncTimers.delete(key);
}

function cancelAllQtyChangeSyncTimers(): void {
  for (const timer of qtyChangeSyncTimers.values()) {
    clearTimeout(timer);
  }
  qtyChangeSyncTimers.clear();
}

/** Run PATCH/full sync immediately (decreases, checkout, post-debounce increases). */
function flushQuantitySyncForVariant(variantId: string): void {
  if (!isRemoteCartConfigured() || !isCartDirty()) return;

  const line = useCartStore
    .getState()
    .lines.find((l) => cartLinesMatchVariant(l, variantId));
  const qty = line?.qty ?? 0;

  noteSyncScheduled();
  useCartStore.setState((s) => ({
    pendingCartSync: true,
    quantitySyncPendingByVariantId: markQuantitySyncPending(
      s.quantitySyncPendingByVariantId,
      variantId,
    ),
  }));

  if (canFastPathQuantitySync(line, qty)) {
    pendingFastQuantityVariantIds.add(variantId);
    cartSyncScheduler.cancelDebounce();
    void cartSyncScheduler.flushSync();
    return;
  }

  pendingFastQuantityVariantIds.clear();
  void cartSyncScheduler.flushSync();
}

/** Coalesce rapid +/- taps — one network sync 500ms after the last change. */
function scheduleDebouncedQuantitySync(variantId: string): void {
  if (!isRemoteCartConfigured()) return;
  const key = variantId.trim();
  if (!key) return;

  /** Drop a pending full-sync debounce (e.g. from addToCart) — qty will flush via fast path. */
  cartSyncScheduler.cancelDebounce();

  cancelQtyChangeSyncTimer(key);
  cartPerfLog(`qty change sync debounced ${CART_SYNC_DEBOUNCE_MS}ms`);
  const timer = setTimeout(() => {
    qtyChangeSyncTimers.delete(key);
    flushQuantitySyncForVariant(key);
  }, CART_SYNC_DEBOUNCE_MS);
  qtyChangeSyncTimers.set(key, timer);
}

function canFastPathQuantitySync(line: CartLine | undefined, qty: number): boolean {
  return (
    qty >= 1 &&
    usesKokobayCartProxy() &&
    Boolean(line?.shopifyLineId?.trim())
  );
}

/** Cancel debounced syncs and invalidate in-flight cart network work. */
function cancelCartBackgroundWork(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = undefined;
  }
  activeSyncGeneration += 1;
  cartSyncFollowUpPending = false;
  forceNextSync = false;
  debounceCoalescedUpdates = 0;
  cartNetworkSyncInFlight = null;
  cancelAllQtyChangeSyncTimers();
  cartSyncScheduler.cancelDebounce();
  pendingFastQuantityVariantIds.clear();
  pendingFastAddVariantIds.clear();
  cartPricingForDisplayCache = null;
}

/**
 * Immediate local bag reset on sign-out — does not block on Shopify/Koko Bay network.
 * Call before clearing auth session so in-flight syncs cannot repopulate the cart.
 */
export function resetCartForSignOut(): void {
  cancelCartBackgroundWork();
  pendingFlushCustomerEmailAfterHydrate = undefined;
  logCartStateTransition('resetCartForSignOut:before_clear', useCartStore.getState().lines.length, cartRevision);
  useCartStore.getState().clear();
  lastSyncedRevision = cartRevision;
  lastSuccessfulCartSyncAtMs = 0;
  void persistCartLines([]);
}

/** Best-effort remote cart clear after sign-out (single DELETE, no reconcile). */
export function clearRemoteCartInBackground(): Promise<void> {
  if (!isRemoteCartConfigured()) return Promise.resolve();
  return (async () => {
    try {
      const guestId = await loadCartGuestId();
      if (usesKokobayCartProxy()) {
        await clearRemoteKokobayCart(guestId, undefined);
        return;
      }
      await syncLocalCartToRemote(null, guestId, [], undefined);
    } catch {
      /* non-fatal */
    }
  })();
}

function checkoutUrlsFromValue(checkoutUrl: string | null | undefined): {
  checkoutUrl: string | null;
  storeCheckoutUrl: string | null;
} {
  const normalized = checkoutUrl?.trim() || null;
  return { checkoutUrl: normalized, storeCheckoutUrl: normalized };
}

/** Re-fetch checkoutUrl from Koko Bay when local state lacks it after sync. */
export async function refreshStoreCheckoutUrl(customerEmail?: string): Promise<string | null> {
  if (!usesKokobayCartProxy()) {
    return useCartStore.getState().storeCheckoutUrl;
  }
  const { storeCheckoutUrl, shopifyCartId } = useCartStore.getState();
  if (storeCheckoutUrl?.trim()) return storeCheckoutUrl.trim();
  if (!shopifyCartId?.trim()) return null;

  const guestId = await loadCartGuestId();
  const refreshed = await fetchRemoteCartCheckoutUrl(guestId, customerEmail);
  if (refreshed) {
    useCartStore.setState(checkoutUrlsFromValue(refreshed));
    console.log('[CHECKOUT] using Shopify checkoutUrl');
  }
  return refreshed;
}

/** Bypass debounce — use at checkout and login only. */
export function flushCartSync(
  customerEmailOrOptions?: string | { force?: boolean; customerEmail?: string },
): Promise<void> {
  const options =
    typeof customerEmailOrOptions === 'string'
      ? { force: true, customerEmail: customerEmailOrOptions }
      : { force: true, ...customerEmailOrOptions };
  const customerEmail = options.customerEmail;
  if (!isRemoteCartConfigured()) return Promise.resolve();

  if (skipCartSyncUntilHydrated('flushCartSync')) {
    if (customerEmail?.trim()) {
      pendingFlushCustomerEmailAfterHydrate = customerEmail.trim();
    }
    return Promise.resolve();
  }

  const { lines } = useCartStore.getState();
  logCartHydrationGate(true, 'flushCartSync');
  logCartStateTransition('flushCartSync', lines.length, cartRevision, {
    hasHydrated: true,
    customerEmail: customerEmail ?? null,
    forceNextSync: true,
    isCartDirty: isCartDirty(),
    preserveLocalCartLines: preserveLocalCartLinesThisSync,
  });
  forceNextSync = true;
  cartSyncScheduler.cancelDebounce();
  useCartStore.setState({ pendingCartSync: true });
  return enqueueCartNetwork(async () => {
    if (pendingFastAddVariantIds.size > 0) {
      await runCartNetworkSync('fast_add', customerEmail);
    }
    if (pendingFastQuantityVariantIds.size > 0) {
      await runCartNetworkSync('fast', customerEmail);
    }
    await runCartNetworkSync('full', customerEmail);
  });
}

/**
 * After sign-in: push guest bag lines to the customer account without clearing local state.
 * Marks the cart dirty when needed so reconcile runs even if the guest cart was already synced.
 */
export async function mergeGuestCartOnLogin(customerEmail: string): Promise<void> {
  const email = customerEmail.trim();
  if (!email || !isRemoteCartConfigured()) return;

  const store = useCartStore.getState();
  if (!store.hasHydrated) {
    await store.hydrate();
  }

  const { lines } = useCartStore.getState();
  logCartStateTransition('mergeGuestCartOnLogin', lines.length, cartRevision, {
    customerEmail: email,
  });

  if (lines.length > 0) {
    if (!isCartDirty()) {
      bumpCartRevision('login_merge_guest_cart');
    }
    preserveLocalCartLinesThisSync = true;
  }

  try {
    await flushCartSync(email);
  } finally {
    preserveLocalCartLinesThisSync = false;
  }
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

  await flushCartSync({ force: true, customerEmail });

  for (let round = 0; round < CHECKOUT_SYNC_MAX_ROUNDS; round += 1) {
    if (isCartSettledForCheckout()) break;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, CHECKOUT_SYNC_SETTLE_MS);
    });
  }

  await refreshStoreCheckoutUrl(customerEmail);
}

function bumpCartRevision(source: string): void {
  const prev = cartRevision;
  cartRevision += 1;
  cartSyncTrace('cart_revision_bump', {
    source,
    cartRevision,
    lastSyncedRevision,
    isCartDirty: cartRevision !== lastSyncedRevision,
    prevRevision: prev,
  });
}

function markCartRevisionSynced(source: string): void {
  const prev = lastSyncedRevision;
  lastSyncedRevision = cartRevision;
  recordCartSyncSuccess();
  cartSyncTrace('cart_revision_synced', {
    source,
    cartRevision,
    lastSyncedRevision,
    prevLastSyncedRevision: prev,
    isCartDirty: false,
  });
}

/** Empty bag or no codes on cart — first-order discount can be auto-applied again this session. */
function notifyFirstAppOrderDiscountRetryAllowed(getState: () => CartState): void {
  if (getIsFirstAppOrderSync() === false) return;
  const { lines, shopifyDiscountCodes } = getState();
  if (hasCartDiscountCodes(shopifyDiscountCodes)) return;
  if (!isFirstAppOrderDiscountApplySettled()) return;
  clearFirstAppOrderDiscountApplySettled();
  logAppFirstOrder('allow_retry', { lineCount: lines.length });
}

function logCartDebug(
  _action: string,
  _details: { lineItemId?: string; quantity?: number; handle?: string },
): void {}

function applyOptimisticLineUpdate(
  lines: CartLine[],
  previous: Pick<
    CartState,
    | 'shopifySubtotal'
    | 'shopifyTotal'
    | 'shopifyTotalTax'
    | 'shopifyDiscountCodes'
    | 'quantitySyncPendingByVariantId'
  >,
  options?: { quantitySyncVariantId?: string },
): Partial<CartState> {
  const totals = optimisticCartTotals(lines);
  const quantitySyncPendingByVariantId = options?.quantitySyncVariantId
    ? markQuantitySyncPending(previous.quantitySyncPendingByVariantId, options.quantitySyncVariantId)
    : previous.quantitySyncPendingByVariantId;

  if (!totals) {
    return options?.quantitySyncVariantId ? { lines, quantitySyncPendingByVariantId } : { lines };
  }

  if (__DEV__) {
    logCartAuditOptimisticUpdate({
      revision: getCartRevisionSnapshot(),
      variantId: options?.quantitySyncVariantId,
      optimisticSubtotal: totals.shopifySubtotal,
      optimisticTotal: hasCartDiscountCodes(previous.shopifyDiscountCodes)
        ? null
        : totals.shopifyTotal,
      hasDiscountCodes: hasCartDiscountCodes(previous.shopifyDiscountCodes),
      previousSubtotal: previous.shopifySubtotal,
      previousTotal: previous.shopifyTotal,
    });
  }

  if (hasCartDiscountCodes(previous.shopifyDiscountCodes)) {
    return {
      lines,
      shopifySubtotal: totals.shopifySubtotal,
      quantitySyncPendingByVariantId,
    };
  }

  return {
    lines,
    shopifySubtotal: totals.shopifySubtotal,
    shopifyTotal: totals.shopifyTotal,
    shopifyTotalTax: previous.shopifyTotalTax,
    quantitySyncPendingByVariantId,
  };
}

function resolveClampedQty(
  requestedQty: number,
  maxQty: number | undefined,
): { qty: number; capped: boolean; cap?: number } {
  const { qty, capped } = clampCartQuantity(requestedQty, maxQty);
  return capped && maxQty != null ? { qty, capped, cap: maxQty } : { qty, capped: false };
}

/** Remote cart accepted fewer units than the optimistic local qty. */
function findInventoryQtyReduction(
  local: CartLine[],
  reconciled: CartLine[],
): { actual: number; requested: number } | null {
  const reconciledByVariant = new Map(
    reconciled.map((line) => [shopifyVariantKey(line.variantId), line]),
  );
  for (const line of local) {
    const synced = reconciledByVariant.get(shopifyVariantKey(line.variantId));
    if (!synced || synced.qty >= line.qty) continue;
    return { actual: synced.qty, requested: line.qty };
  }
  return null;
}

async function applyRemoteCartSyncResult(
  revisionAtStart: number,
  syncGeneration: number,
  result: Awaited<ReturnType<typeof syncLocalCartToRemote>>,
  customerEmail?: string,
): Promise<void> {
  if (syncGeneration !== activeSyncGeneration) return;
  if (revisionAtStart !== cartRevision) {
    cartSyncTrace('apply_remote_result_revision_mismatch', {
      revisionAtStart,
      cartRevision,
      lastSyncedRevision,
      cartSyncRunnerInFlight,
      isCartDirty: isCartDirty(),
    });
    if (cartSyncRunnerInFlight) {
      cartSyncFollowUpPending = true;
      cartCoalesceLog('pending sync detected');
    } else {
      scheduleSync('apply_remote_cart_sync_result:revision_mismatch');
    }
    return;
  }
  if (!result) {
    if (isCartDirty() && cartSyncRunnerInFlight) {
      cartSyncFollowUpPending = true;
    }
    return;
  }
  if (result.guestId) {
    await persistCartGuestId(result.guestId);
  }
  const snapshot = result.snapshot;
  if (!snapshot) {
    useCartStore.setState({
      quantitySyncPendingByVariantId: clearAllQuantitySyncPending(),
    });
    if (!result.syncError && revisionAtStart === cartRevision) {
      markCartRevisionSynced('apply_remote_cart_sync_result_no_snapshot');
      cartSyncFollowUpPending = false;
    } else if (isCartDirty() && cartSyncRunnerInFlight) {
      cartSyncFollowUpPending = true;
    }
    return;
  }

  const localLines = useCartStore.getState().lines;
  const learnInventoryCap = result.syncError?.code === 'insufficient_inventory';
  const reconciledLines = mergeSyncedCartLines(localLines, snapshot.lines, {
    dropLinesMissingOnRemote:
      Boolean(result.syncError) && !preserveLocalCartLinesThisSync,
    learnInventoryCap,
  });
  const inventoryReduction = findInventoryQtyReduction(localLines, reconciledLines);
  const lineIdentity = localLines.map((line) => {
    const synced = reconciledLines.find((row) =>
      cartLinesMatchVariant(row, line.variantId),
    );
    return {
      variantId: line.variantId,
      localQty: line.qty,
      reconciledQty: synced?.qty,
      localShopifyLineId: line.shopifyLineId ?? null,
      reconciledShopifyLineId: synced?.shopifyLineId ?? null,
      shopifyLineIdChanged:
        (line.shopifyLineId ?? '') !== (synced?.shopifyLineId ?? line.shopifyLineId ?? ''),
    };
  });
  useCartStore.getState().applyRemoteSnapshot(snapshot, reconciledLines);
  await persistShopifyCartId(snapshot.cartId);

  if (result.syncError) {
    cartSyncTrace('apply_remote_result_stays_dirty', {
      reason: 'sync_error',
      code: result.syncError.code,
      revisionAtStart,
      cartRevision,
      lastSyncedRevision,
      lineIdentity,
    });
    reportOperationalFailure(result.syncError.message, {
      source: 'cart_sync',
      code: result.syncError.code,
    });
    showToast(cartSyncErrorToast(result.syncError, reconciledLines));
  } else if (revisionAtStart === cartRevision) {
    markCartRevisionSynced('apply_remote_cart_sync_result');
    if (inventoryReduction != null) {
      cartSyncTrace('apply_remote_result_inventory_cap', {
        actual: inventoryReduction.actual,
        requested: inventoryReduction.requested,
        lineIdentity,
      });
      showToast(
        inventoryLimitToast(inventoryReduction.actual, {
          requested: inventoryReduction.requested,
          kind: 'set',
        }),
      );
    } else {
      cartSyncTrace('apply_remote_result_marked_clean', {
        revisionAtStart,
        cartRevision,
        lineIdentity,
      });
    }
  } else {
    cartSyncTrace('apply_remote_result_stays_dirty', {
      reason: 'revision_changed_during_apply',
      revisionAtStart,
      cartRevision,
      lastSyncedRevision,
      lineIdentity,
    });
  }

  if (!result.syncError) {
    void import('@/services/cart/auto-first-app-order-discount')
      .then((mod) => {
        mod.maybeAutoApplyFirstAppOrderDiscount(customerEmail);
      })
      .catch(() => {});
  }
}

/** POST new line(s) — bypasses GET /api/cart and reconcile. */
async function syncAddFast(customerEmail?: string): Promise<void> {
  recordForegroundAuditCart('syncAddFast', { reason: 'network_sync' });
  if (!isRemoteCartConfigured()) return;

  const variantIds = [...pendingFastAddVariantIds];
  pendingFastAddVariantIds.clear();
  if (!variantIds.length) return;

  if (AppState.currentState !== 'active') {
    for (const id of variantIds) pendingFastAddVariantIds.add(id);
    for (const id of variantIds) scheduleFastAddSync(id);
    return;
  }

  const revisionAtStart = cartRevision;
  const syncGeneration = ++activeSyncGeneration;
  useCartStore.setState({ isSyncingShopify: true, pendingCartSync: true });

  cartSyncTrace('sync_add_fast_start', {
    revisionAtStart,
    cartRevision,
    lastSyncedRevision,
    variantIds,
  });

  let appliedCount = 0;

  try {
    let guestId = await loadCartGuestId();

    for (const variantId of variantIds) {
      if (syncGeneration !== activeSyncGeneration || revisionAtStart !== cartRevision) {
        cartSyncTrace('sync_add_fast_abort', {
          reason: 'generation_or_revision_changed',
          revisionAtStart,
          cartRevision,
        });
        break;
      }

      const { lines, checkoutUrl, storeCheckoutUrl } = useCartStore.getState();
      const line = lines.find((l) => cartLinesMatchVariant(l, variantId));
      if (!line || line.qty < 1) {
        cartSyncTrace('sync_add_fast_fallback_full', {
          reason: 'missing_line',
          variantId,
        });
        scheduleSync('sync_add_fast:missing_line');
        return;
      }

      cartSyncTrace('sync_add_fast_post', {
        variantId,
        qty: line.qty,
        hadShopifyLineId: Boolean(line.shopifyLineId?.trim()),
      });

      const lastResult = await postCartAddLineFast(
        guestId,
        variantId,
        line.qty,
        lines,
        customerEmail,
        storeCheckoutUrl ?? checkoutUrl,
      );
      if (lastResult?.guestId) guestId = lastResult.guestId;

      if (lastResult?.syncError) {
        cartSyncTrace('sync_add_fast_fallback_full', {
          reason: 'post_sync_error',
          code: lastResult.syncError.code,
        });
        reportOperationalFailure(lastResult.syncError.message, {
          source: 'cart_fast_add',
          code: lastResult.syncError.code,
        });
        scheduleSync('sync_add_fast:post_sync_error');
        return;
      }
      if (!lastResult?.snapshot) {
        cartSyncTrace('sync_add_fast_fallback_full', { reason: 'post_no_snapshot' });
        if (cartSyncRunnerInFlight) {
          cartSyncFollowUpPending = true;
        } else {
          scheduleSync('sync_add_fast:no_snapshot');
        }
        return;
      }

      await applyRemoteCartSyncResult(revisionAtStart, syncGeneration, lastResult, customerEmail);
      appliedCount += 1;
    }

    const syncState = {
      isCartDirty: isCartDirty(),
      cartRevision,
      lastSyncedRevision,
    };

    const completedClean =
      appliedCount === variantIds.length &&
      syncState.isCartDirty === false &&
      cartRevision === revisionAtStart &&
      !cartSyncFollowUpPending;

    if (completedClean) {
      logFastAddSuccess(syncState);
      cartSyncFollowUpPending = false;
    } else {
      cartSyncTrace('sync_add_fast_complete_not_clean', {
        revisionAtStart,
        appliedCount,
        expectedCount: variantIds.length,
        cartSyncFollowUpPending,
        ...syncState,
      });
      logCartSyncRevisionState('fast_add_complete_not_clean', syncState);
    }
  } finally {
    if (syncGeneration === activeSyncGeneration) {
      useCartStore.setState({ isSyncingShopify: false });
    }
    finalizePendingCartSync();
  }
}

/** PATCH-only quantity sync — bypasses GET /api/cart and reconcile. */
async function syncQuantityFast(customerEmail?: string): Promise<void> {
  recordForegroundAuditCart('syncQuantityFast', { reason: 'network_sync' });
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

  cartSyncTrace('sync_quantity_fast_start', {
    revisionAtStart,
    cartRevision,
    lastSyncedRevision,
    variantIds,
  });

  try {
    let guestId = await loadCartGuestId();
    let lastResult: Awaited<ReturnType<typeof patchCartQuantityFast>> = null;

    for (const variantId of variantIds) {
      if (syncGeneration !== activeSyncGeneration || revisionAtStart !== cartRevision) {
        cartSyncTrace('sync_quantity_fast_abort', {
          reason: 'generation_or_revision_changed',
          revisionAtStart,
          cartRevision,
          syncGeneration,
          activeSyncGeneration,
        });
        break;
      }

      const lines = useCartStore.getState().lines;
      const line = lines.find((l) => cartLinesMatchVariant(l, variantId));
      const lineId = line?.shopifyLineId?.trim();
      if (!line || !lineId || line.qty < 1) {
        cartSyncTrace('sync_quantity_fast_fallback_full', {
          reason: 'missing_line_or_shopify_line_id',
          variantId,
          hasLine: Boolean(line),
          lineId: lineId ?? null,
          qty: line?.qty,
        });
        scheduleSync('sync_quantity_fast:missing_line_or_line_id');
        return;
      }

      cartSyncTrace('sync_quantity_fast_patch', {
        variantId,
        qty: line.qty,
        shopifyLineId: lineId,
        revisionAtStart,
        cartRevision,
      });

      lastResult = await patchCartQuantityFast(
        guestId,
        lineId,
        line.qty,
        lines,
        customerEmail,
        useCartStore.getState().storeCheckoutUrl ?? useCartStore.getState().checkoutUrl,
      );
      if (lastResult?.guestId) guestId = lastResult.guestId;

      if (lastResult?.syncError) {
        cartSyncTrace('sync_quantity_fast_fallback_full', {
          reason: 'patch_sync_error',
          code: lastResult.syncError.code,
        });
        reportOperationalFailure(lastResult.syncError.message, {
          source: 'cart_fast_sync',
          code: lastResult.syncError.code,
        });
        scheduleSync('sync_quantity_fast:patch_sync_error');
        return;
      }
      if (!lastResult?.snapshot) {
        cartSyncTrace('sync_quantity_fast_fallback_full', { reason: 'patch_no_snapshot' });
        useCartStore.setState({
          quantitySyncPendingByVariantId: clearAllQuantitySyncPending(),
        });
        if (cartSyncRunnerInFlight) {
          cartSyncFollowUpPending = true;
        } else {
          scheduleSync('sync_quantity_fast:no_snapshot');
        }
        return;
      }

      await applyRemoteCartSyncResult(revisionAtStart, syncGeneration, lastResult, customerEmail);
    }

    cartSyncTrace('sync_quantity_fast_complete', {
      revisionAtStart,
      cartRevision,
      lastSyncedRevision,
      isCartDirty: isCartDirty(),
      cartSyncFollowUpPending,
    });
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
  storeCheckoutUrl: null,
  shopifySubtotal: null,
  shopifyTotal: null,
  shopifyTotalTax: null,
  shopifyDiscountCodes: [],
  shopifyCartDiscountAmount: null,
  shopifyLineMerchandiseSubtotal: null,
  shopifyLineMerchandiseTotal: null,
  reservedDiscountPricing: null,
  displayAppliedDiscounts: [],
  isSyncingShopify: false,
  pendingCartSync: false,
  quantitySyncPendingByVariantId: {},
  hasHydrated: false,

  hydrate: async () => {
    if (__DEV__) recordHydration('cart', get().hasHydrated);
    if (get().hasHydrated) return;
    const [loaded, shopifyCartId] = await Promise.all([loadPersistedCart(), loadShopifyCartId()]);
    set((s) => ({
      lines: mergeCartLines(loaded, s.lines),
      shopifyCartId,
      hasHydrated: true,
    }));

    const lines = get().lines;
    logCartStateTransition('hydrate:loaded', lines.length, cartRevision, {
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
      bumpCartRevision('hydrate');
      scheduleSync(
        missingDisplayLines.length > 0 ? 'hydrate:missing_display' : 'hydrate',
      );
      finishCartHydrationPostSync();
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
      bumpCartRevision('hydrate:checkout_refresh');
      scheduleSync('hydrate:trusted_persisted');
      logCartStateTransition('hydrate_deferred_sync', lines.length, cartRevision, {
        reason: 'persisted_session_checkout_refresh',
        lastSyncedRevision,
      });
    }

    finishCartHydrationPostSync();
  },

  syncWithShopify: async (customerEmail?: string) => {
    if (!isRemoteCartConfigured()) return;

    if (skipCartSyncUntilHydrated('syncWithShopify')) {
      finalizePendingCartSync();
      return;
    }
    logCartHydrationGate(true, 'syncWithShopify');

    if (AppState.currentState !== 'active') {
      scheduleSync('sync_with_shopify:background');
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
    recordForegroundAuditCart('syncWithShopify', { reason: 'manual_or_scheduler' });
    const revisionAtStart = cartRevision;
    const { lines, shopifyCartId, checkoutUrl, storeCheckoutUrl, hasHydrated } = get();
    logCartStateTransition('syncWithShopify:start', lines.length, cartRevision, {
      revisionAtStart,
      force,
      hasHydrated,
      isCartDirty: isCartDirty(),
      lastSyncedRevision,
      shopifyCartId: shopifyCartId ?? null,
    });
    const guestId = await loadCartGuestId();
    cartPerfLog(
      `syncWithShopify start lines=${lines.length} revision=${revisionAtStart} ` +
        `withLineIds=${lines.filter((l) => l.shopifyLineId).length}`,
    );

    if (!lines.length) {
      if (preserveLocalCartLinesThisSync) {
        cartSyncTrace('login_merge_skip_empty_delete', {
          revisionAtStart,
          customerEmail: customerEmail ?? null,
        });
        finalizePendingCartSync();
        return;
      }
      logCartStateTransition('syncWithShopify:empty_local', 0, cartRevision, {
        revisionAtStart,
        willDeleteRemote: Boolean(shopifyCartId || guestId),
      });
      set({
        shopifyCartId: null,
        ...checkoutUrlsFromValue(null),
        shopifySubtotal: null,
        shopifyTotal: null,
        shopifyTotalTax: null,
        shopifyDiscountCodes: [],
        shopifyCartDiscountAmount: null,
        shopifyLineMerchandiseSubtotal: null,
        shopifyLineMerchandiseTotal: null,
        reservedDiscountPricing: null,
        displayAppliedDiscounts: [],
        isSyncingShopify: false,
      });
      if (shopifyCartId || guestId) {
        await syncLocalCartToRemote(shopifyCartId, guestId, [], customerEmail);
      }
      await persistShopifyCartId(null);
      if (revisionAtStart === cartRevision) {
        lastSyncedRevision = cartRevision;
        recordCartSyncSuccess();
      }
      finalizePendingCartSync();
      notifyFirstAppOrderDiscountRetryAllowed(get);
      return;
    }

    const syncGeneration = ++activeSyncGeneration;
    set({ isSyncingShopify: true, pendingCartSync: true });
    try {
      const result = await syncLocalCartToRemote(
        shopifyCartId,
        guestId,
        lines,
        customerEmail,
        storeCheckoutUrl ?? checkoutUrl,
      );
      await applyRemoteCartSyncResult(revisionAtStart, syncGeneration, result, customerEmail);
      if (revisionAtStart === cartRevision) {
        cartSyncFollowUpPending = false;
      }
    } finally {
      if (syncGeneration === activeSyncGeneration) {
        set({ isSyncingShopify: false });
      }
      finalizePendingCartSync();
      logCartStateTransition('syncWithShopify:finished', get().lines.length, cartRevision, {
        revisionAtStart,
        durationMs: Math.round(performance.now() - syncStoreStart),
      });
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
    const wasEmpty = get().lines.length === 0;
    const existing = get().lines.find(
      (l) => l.handle === handle && cartLinesMatchVariant(l, variantId),
    );
    const isNewLine = !existing;
    const hadShopifyLineId = Boolean(existing?.shopifyLineId?.trim());
    bumpCartRevision('add_to_cart');
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
    if (wasEmpty) {
      notifyFirstAppOrderDiscountRetryAllowed(get);
    }
    scheduleAppBenefitsRefreshOnCartChange();

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
    bumpCartRevision('remove_item');
    set((s) => {
      const lines = s.lines.filter((l) => !cartLinesMatchVariant(l, variantId));
      if (!lines.length) {
        return {
          lines,
          shopifyCartId: null,
          ...checkoutUrlsFromValue(null),
          shopifySubtotal: null,
          shopifyTotal: null,
          shopifyTotalTax: null,
          shopifyDiscountCodes: [],
          shopifyCartDiscountAmount: null,
          shopifyLineMerchandiseSubtotal: null,
          shopifyLineMerchandiseTotal: null,
          reservedDiscountPricing: null,
          displayAppliedDiscounts: [],
        };
      }
      return applyOptimisticLineUpdate(lines, s, { quantitySyncVariantId: variantId });
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
    bumpCartRevision('update_quantity');
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
        return {
          lines,
          shopifyCartId: null,
          ...checkoutUrlsFromValue(null),
          shopifySubtotal: null,
          shopifyTotal: null,
          shopifyTotalTax: null,
          shopifyDiscountCodes: [],
          shopifyCartDiscountAmount: null,
          shopifyLineMerchandiseSubtotal: null,
          shopifyLineMerchandiseTotal: null,
          reservedDiscountPricing: null,
          displayAppliedDiscounts: [],
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
    const beforeLines = get().lines.length;
    logCartStateTransition('applyRemoteSnapshot:before', beforeLines, cartRevision, {
      remoteLineCount: snapshot.lines.length,
      cartId: snapshot.cartId,
    });
    const merged =
      reconciledLines ??
      mergeSyncedCartLines(useCartStore.getState().lines, snapshot.lines);
    const { lines, qtyReduced: subtotalQtyReduced } = reconcileLinesWithSnapshotSubtotal(
      merged,
      snapshot,
    );
    const discountCodes = snapshot.discountCodes ?? [];
    const pricing = {
      shopifySubtotal: snapshot.subtotal,
      shopifyTotal: snapshot.total,
      shopifyTotalTax: snapshot.totalTax ?? null,
      shopifyDiscountCodes: discountCodes,
      shopifyCartDiscountAmount: snapshot.cartDiscountAmount ?? null,
      shopifyLineMerchandiseSubtotal: snapshot.lineMerchandiseSubtotal ?? null,
      shopifyLineMerchandiseTotal: snapshot.lineMerchandiseTotal ?? null,
    };
    const displayAppliedDiscounts = deriveAppliedDiscountsFromCart({
      subtotal: snapshot.subtotal,
      total: snapshot.total,
      totalTax: snapshot.totalTax ?? null,
      discountCodes,
      cartDiscountAmount: snapshot.cartDiscountAmount ?? null,
      lineMerchandiseSubtotal: snapshot.lineMerchandiseSubtotal ?? null,
      lineMerchandiseTotal: snapshot.lineMerchandiseTotal ?? null,
    });
    const resolvedCheckoutUrl =
      snapshot.checkoutUrl?.trim() || get().storeCheckoutUrl?.trim() || null;
    set({
      lines,
      shopifyCartId: snapshot.cartId,
      ...checkoutUrlsFromValue(resolvedCheckoutUrl),
      ...pricing,
      displayAppliedDiscounts,
      reservedDiscountPricing: hasCartDiscountCodes(discountCodes)
        ? pricing
        : null,
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
          revision: getCartRevisionSnapshot(),
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
    logCartStateTransition('applyRemoteSnapshot:after', get().lines.length, cartRevision, {
      beforeLines,
      remoteLineCount: snapshot.lines.length,
    });
  },

  clear: () => {
    logCartStateTransition('clear:before', get().lines.length, cartRevision);
    pendingFastQuantityVariantIds.clear();
    pendingFastAddVariantIds.clear();
    cartSyncScheduler.cancelDebounce();
    bumpCartRevision('clear');
    set({
      lines: [],
      shopifyCartId: null,
      ...checkoutUrlsFromValue(null),
      shopifySubtotal: null,
      shopifyTotal: null,
      shopifyTotalTax: null,
      shopifyDiscountCodes: [],
      shopifyCartDiscountAmount: null,
      shopifyLineMerchandiseSubtotal: null,
      shopifyLineMerchandiseTotal: null,
      reservedDiscountPricing: null,
      displayAppliedDiscounts: [],
      pendingCartSync: false,
      quantitySyncPendingByVariantId: clearAllQuantitySyncPending(),
    });
    void persistShopifyCartId(null);
    void persistCartGuestId(null);
    notifyFirstAppOrderDiscountRetryAllowed(get);
    logCartStateTransition('clear:after', 0, cartRevision);
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
        logCartStateTransition('persist_rollback', rollback.length, cartRevision, {
          attemptedLineCount: snapshot.length,
        });
        useCartStore.setState({ lines: rollback });
      }
    })();
  }, 140);
});
