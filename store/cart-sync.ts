import { AppState } from 'react-native';
import type { StoreApi } from 'zustand';

import { isCartRecoveryEnabled } from '@/lib/cart-recovery-access';
import { cartCoalesceLog } from '@/lib/cart-coalesce-log';
import { recordForegroundAuditCart } from '@/lib/foreground-audit';
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
import { logCartTrace, logCartTraceWithStore } from '@/lib/cart-trace-log';
import { reportOperationalFailure } from '@/lib/appErrorLog';
import { showToast } from '@/store/toast';
import { fetchKokobayCartSnapshotReadOnly, clearRemoteKokobayCart, fetchRemoteCartCheckoutUrl } from '@/services/kokobay-web/cart';
import { isRemoteCartConfigured, usesKokobayCartProxy } from '@/services/cart/remote-cart';
import {
  patchCartQuantityFast,
  postCartAddLineFast,
  syncLocalCartToRemote,
} from '@/services/cart/sync';
import {
  decideCartForegroundResumeSync,
  type CartResumeSyncDecision,
} from '@/store/cart-resume-sync';
import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';
import type { CartAppliedDiscount } from '@/utils/cart-cost-breakdown';
import { inventoryLimitToast } from '@/utils/cart-inventory';
import { cartSyncErrorToast } from '@/utils/cart-sync-messages';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';
import type { CartPricingAuditRevision } from '@/lib/cart-pricing-audit';
import { CART_SYNC_DEBOUNCE_MS, createCartSyncScheduler } from './cart-sync-scheduler';
import {
  cancelCartPersistenceTimer,
  resetCartHydrateStateForTests,
} from './cart-persistence';
import {
  loadCartGuestId,
  persistCartGuestId,
  persistCartLines,
  persistShopifyCartId,
  clearCartSecureStore,
} from './cart-persist';
import { emptyCartDiscountFields } from './cart-discounts';
import { notifyFirstAppOrderDiscountRetryAllowed } from './cart-discounts';
import {
  cartLinesMatchVariant,
  mergeCartLineMaxQty,
  reconcileCartLinesServerAuthoritative,
  type CartLineReconciliationMode,
} from './cart-line-utils';
import { checkoutUrlsFromValue, clearCartPricingFields, resetCartPricingCacheForTests } from './cart-pricing';
import type { CartRecoveryResult, CartState } from './cart-types';
import { applyValidatedRemoteSnapshot, logCartHealthStatus } from './cart-snapshot-gateway';
import {
  noteCartSyncPendingActive,
  noteCartSyncPendingIdle,
  noteCartSyncingShopifyActive,
  noteCartSyncingShopifyIdle,
  resetCartSyncWatchdogForTests,
} from './cart-sync-watchdog';
import { resetCartSnapshotGatewayForTests } from './cart-snapshot-gateway';

type CartStore = StoreApi<CartState>;

let getCartStore: () => CartStore;

export function bindCartSyncStore(getter: () => CartStore): void {
  getCartStore = getter;
}

type CartSyncFlagState = Pick<CartState, 'pendingCartSync' | 'isSyncingShopify'>;

function patchCartSyncFlags(
  patch: Partial<CartSyncFlagState>,
  write: CartStore['setState'],
): void {
  write((state) => {
    const next: Partial<CartSyncFlagState> = {};
    if (patch.pendingCartSync === true && !state.pendingCartSync) {
      next.pendingCartSync = true;
    } else if (patch.pendingCartSync === false && state.pendingCartSync) {
      next.pendingCartSync = false;
    }
    if (patch.isSyncingShopify === true && !state.isSyncingShopify) {
      next.isSyncingShopify = true;
    } else if (patch.isSyncingShopify === false && state.isSyncingShopify) {
      next.isSyncingShopify = false;
    }
    return Object.keys(next).length > 0 ? next : state;
  });
}

function markPendingCartSync(): void {
  noteCartSyncPendingActive();
  patchCartSyncFlags({ pendingCartSync: true }, getCartStore().setState);
}

function markSyncingShopifyActive(): void {
  noteCartSyncPendingActive();
  noteCartSyncingShopifyActive();
  patchCartSyncFlags(
    { isSyncingShopify: true, pendingCartSync: true },
    getCartStore().setState,
  );
}

function markSyncingShopifyIdle(): void {
  noteCartSyncingShopifyIdle();
  patchCartSyncFlags({ isSyncingShopify: false }, getCartStore().setState);
}

function clearQuantitySyncPendingIfNeeded(): void {
  const { quantitySyncPendingByVariantId } = getCartStore().getState();
  if (Object.keys(quantitySyncPendingByVariantId).length === 0) return;
  getCartStore().setState({ quantitySyncPendingByVariantId: clearAllQuantitySyncPending() });
}

/** Reconciliation mode for the next debounced / flushed full sync (fast paths stay optimistic). */
let debouncedSyncReconciliationMode: CartLineReconciliationMode = 'optimistic';
/** Reconciliation mode for the active cart network run. */
let activeRunReconciliationMode: CartLineReconciliationMode = 'optimistic';

function noteDebouncedReconciliationMode(mode: CartLineReconciliationMode): void {
  if (mode === 'server_authoritative') {
    debouncedSyncReconciliationMode = 'server_authoritative';
    return;
  }
  if (debouncedSyncReconciliationMode !== 'server_authoritative') {
    debouncedSyncReconciliationMode = 'optimistic';
  }
}

function takeDebouncedReconciliationMode(): CartLineReconciliationMode {
  const mode = debouncedSyncReconciliationMode;
  debouncedSyncReconciliationMode = 'optimistic';
  return mode;
}

function scheduleSnapshotRecovery(): void {
  noteDebouncedReconciliationMode('server_authoritative');
  scheduleSync('snapshot_recovery');
}

function flushAuthoritativeCartSync(customerEmail?: string): Promise<void> {
  return flushCartSync({
    force: true,
    customerEmail,
    reconciliationMode: 'server_authoritative',
  });
}

function reconciliationModeForScheduleSource(source: string): CartLineReconciliationMode {
  if (source.startsWith('hydrate') || source.startsWith('snapshot_recovery')) {
    return 'server_authoritative';
  }
  return 'optimistic';
}

function reconcileLinesForRemoteApply(
  localLines: CartLine[],
  remoteLines: CartLine[],
  mode: CartLineReconciliationMode,
  options: { syncError: boolean; learnInventoryCap: boolean },
): CartLine[] {
  if (mode === 'server_authoritative') {
    return reconcileCartLinesServerAuthoritative(localLines, remoteLines);
  }
  return mergeSyncedCartLines(localLines, remoteLines, {
    dropLinesMissingOnRemote: options.syncError && !preserveLocalCartLinesThisSync,
    learnInventoryCap: options.learnInventoryCap,
  });
}

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
      next.maxQty = mergeCartLineMaxQty(line.maxQty, synced.qty);
    }
    return next;
  });
  if (!options?.dropLinesMissingOnRemote) return merged;
  return merged.filter((line) => remoteByVariant.has(shopifyVariantKey(line.variantId)));
}

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
/** Debounced remote sync for +/- qty (optimistic qty is still immediate). */
const qtyChangeSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
  const { hasHydrated } = getCartStore().getState();
  console.log(
    `[CART_HYDRATION_GATE] hasHydrated=${hasHydrated} syncAllowed=${syncAllowed} reason=${reason}`,
  );
}

function skipCartSyncUntilHydrated(caller: string): boolean {
  if (getCartStore().getState().hasHydrated) {
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

  if (pendingEmail && getCartStore().getState().lines.length > 0) {
    void mergeGuestCartOnLogin(pendingEmail);
    return;
  }

  if (isRemoteCartConfigured() && isCartDirty()) {
    scheduleSync('hydrate_post:dirty');
  }
}

/** Queue login cart merge until SecureStore hydrate completes (avoids concurrent hydrate races). */
export function deferCartMergeUntilHydrate(customerEmail: string): void {
  const email = customerEmail.trim();
  if (!email) return;
  pendingFlushCustomerEmailAfterHydrate = email;
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
  const state = getCartStore().getState();
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
  activeRunReconciliationMode = takeDebouncedReconciliationMode();
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
        await getCartStore().getState().syncWithShopify(customerEmail);
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
    activeRunReconciliationMode = 'optimistic';
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
    onSyncArm: (reason) => {
      if (reason === 'foreground_resume') {
        noteDebouncedReconciliationMode('server_authoritative');
      }
    },
  },
);

function finalizePendingCartSync(): void {
  const state = getCartStore().getState();
  if (state.isSyncingShopify || isCartSyncPending()) return;
  const hasPendingUiState =
    state.pendingCartSync || Object.keys(state.quantitySyncPendingByVariantId).length > 0;
  if (!hasPendingUiState) return;
  getCartStore().setState({
    pendingCartSync: false,
    quantitySyncPendingByVariantId: clearAllQuantitySyncPending(),
  });
  noteCartSyncPendingIdle();
  logCartHealthStatus();
}

function scheduleSync(source: string): void {
  const { lines, hasHydrated } = getCartStore().getState();
  noteDebouncedReconciliationMode(reconciliationModeForScheduleSource(source));
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
  logCartTraceWithStore('schedule_sync', {
    source,
    isCartDirty: isCartDirty(),
    cartRevision,
    lastSyncedRevision,
  });
  if (skipCartSyncUntilHydrated(`scheduleSync:${source}`)) return;
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  noteSyncScheduled();
  if (!cartSyncRunnerInFlight) {
    pendingFastQuantityVariantIds.clear();
    pendingFastAddVariantIds.clear();
  }
  markPendingCartSync();
  cartSyncScheduler.scheduleSync();
}

function scheduleFastAddSync(variantId: string): void {
  if (skipCartSyncUntilHydrated('scheduleFastAddSync')) return;
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  const key = variantId.trim();
  if (!key) return;
  noteSyncScheduled();
  pendingFastAddVariantIds.add(key);
  markPendingCartSync();
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
  markPendingCartSync();
  cartSyncScheduler.cancelDebounce();
  void cartSyncScheduler.flushSync();
}

function scheduleFastQuantitySync(variantId: string): void {
  if (!isRemoteCartConfigured() || !isCartDirty()) return;
  noteSyncScheduled();
  pendingFastQuantityVariantIds.add(variantId);
  markPendingCartSync();
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

  const line = getCartStore()
    .getState()
    .lines.find((l) => cartLinesMatchVariant(l, variantId));
  const qty = line?.qty ?? 0;

  noteSyncScheduled();
  const state = getCartStore().getState();
  const quantitySyncPendingByVariantId = markQuantitySyncPending(
    state.quantitySyncPendingByVariantId,
    variantId,
  );
  if (!state.pendingCartSync) {
    getCartStore().setState({ pendingCartSync: true, quantitySyncPendingByVariantId });
  } else if (quantitySyncPendingByVariantId !== state.quantitySyncPendingByVariantId) {
    getCartStore().setState({ quantitySyncPendingByVariantId });
  }

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

const INITIAL_CART_STORE_STATE = {
  lines: [] as CartLine[],
  shopifyCartId: null as string | null,
  checkoutUrl: null as string | null,
  storeCheckoutUrl: null as string | null,
  shopifySubtotal: null as Money | null,
  shopifyTotal: null as Money | null,
  shopifyTotalTax: null as Money | null,
  shopifyDiscountCodes: [] as CartDiscountCode[],
  shopifyCartDiscountAmount: null as Money | null,
  shopifyLineMerchandiseSubtotal: null as Money | null,
  shopifyLineMerchandiseTotal: null as Money | null,
  reservedDiscountPricing: null,
  displayAppliedDiscounts: [] as CartAppliedDiscount[],
  isSyncingShopify: false,
  pendingCartSync: false,
  quantitySyncPendingByVariantId: {} as Record<string, true>,
  hasHydrated: false,
};

/**
 * @internal Reset in-memory cart orchestration between integration tests.
 * Does not clear SecureStore unless `clearPersistedCart` is true.
 */
export async function resetCartStateForTests(options?: { clearPersistedCart?: boolean }): Promise<void> {
  cancelCartBackgroundWork();
  cartRevision = 0;
  lastSyncedRevision = 0;
  lastSuccessfulCartSyncAtMs = 0;
  activeSyncGeneration = 0;
  cartNetworkChain = Promise.resolve();
  cartNetworkQueueDepth = 0;
  cartNetworkMaxQueueDepth = 0;
  cartSyncRunnerInFlight = false;
  cartSyncFollowUpPending = false;
  cartNetworkSyncInFlight = null;
  debounceRevisionBaseline = 0;
  debounceCoalescedUpdates = 0;
  cartSyncCount = 0;
  cartSyncTotalDurationMs = 0;
  pendingFlushCustomerEmailAfterHydrate = undefined;
  resetCartHydrateStateForTests();
  preserveLocalCartLinesThisSync = false;
  resetCartPricingCacheForTests();
  resetCartSnapshotGatewayForTests();
  resetCartSyncWatchdogForTests();

  getCartStore().setState({ ...INITIAL_CART_STORE_STATE });

  if (options?.clearPersistedCart) {
    await clearCartSecureStore();
  }
}

/** Cancel debounced syncs and invalidate in-flight cart network work. */
function cancelCartBackgroundWork(): void {
  cancelCartPersistenceTimer();
  activeSyncGeneration += 1;
  cartSyncFollowUpPending = false;
  forceNextSync = false;
  debounceCoalescedUpdates = 0;
  cartNetworkSyncInFlight = null;
  cancelAllQtyChangeSyncTimers();
  cartSyncScheduler.cancelDebounce();
  pendingFastQuantityVariantIds.clear();
  pendingFastAddVariantIds.clear();
  resetCartPricingCacheForTests();
}

/**
 * Immediate local bag reset on sign-out — does not block on Shopify/Koko Bay network.
 * Call before clearing auth session so in-flight syncs cannot repopulate the cart.
 */
export function resetCartForSignOut(): void {
  cancelCartBackgroundWork();
  pendingFlushCustomerEmailAfterHydrate = undefined;
  logCartStateTransition('resetCartForSignOut:before_clear', getCartStore().getState().lines.length, cartRevision);
  getCartStore().getState().clear();
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

/** Re-fetch checkoutUrl from Koko Bay when local state lacks it after sync. */
export async function refreshStoreCheckoutUrl(customerEmail?: string): Promise<string | null> {
  if (!usesKokobayCartProxy()) {
    return getCartStore().getState().storeCheckoutUrl;
  }
  const { storeCheckoutUrl, shopifyCartId } = getCartStore().getState();
  if (storeCheckoutUrl?.trim()) return storeCheckoutUrl.trim();
  if (!shopifyCartId?.trim()) return null;

  const guestId = await loadCartGuestId();
  const refreshed = await fetchRemoteCartCheckoutUrl(guestId, customerEmail);
  if (refreshed) {
    getCartStore().setState(checkoutUrlsFromValue(refreshed));
    console.log('[CHECKOUT] using Shopify checkoutUrl');
  }
  return refreshed;
}

/** Bypass debounce — use at checkout and login only. */
export function flushCartSync(
  customerEmailOrOptions?: string | {
    force?: boolean;
    customerEmail?: string;
    reconciliationMode?: CartLineReconciliationMode;
  },
): Promise<void> {
  const options =
    typeof customerEmailOrOptions === 'string'
      ? { force: true, customerEmail: customerEmailOrOptions }
      : { force: true, ...customerEmailOrOptions };
  const customerEmail = options.customerEmail;
  noteDebouncedReconciliationMode(options.reconciliationMode ?? 'optimistic');
  if (!isRemoteCartConfigured()) return Promise.resolve();

  if (skipCartSyncUntilHydrated('flushCartSync')) {
    if (customerEmail?.trim()) {
      pendingFlushCustomerEmailAfterHydrate = customerEmail.trim();
    }
    return Promise.resolve();
  }

  const { lines } = getCartStore().getState();
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
  markPendingCartSync();
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

  const store = getCartStore().getState();
  if (!store.hasHydrated) {
    await store.hydrate();
  }

  const { lines } = getCartStore().getState();
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
    await flushCartSync({ customerEmail: email, reconciliationMode: 'server_authoritative' });
  } finally {
    preserveLocalCartLinesThisSync = false;
  }
}

export type { CartRecoveryResult } from './cart-types';

function cartRecoveryUnauthorized(): CartRecoveryResult {
  return { ok: false, message: 'Cart recovery is not enabled for this build.' };
}

/** Dev/admin — wipe SecureStore cart keys and reset in-memory bag without syncing or adjusting qty. */
export async function recoverCartClearLocalStorage(): Promise<CartRecoveryResult> {
  if (!isCartRecoveryEnabled()) return cartRecoveryUnauthorized();

  cancelCartBackgroundWork();
  await clearCartSecureStore();

  bumpCartRevision('recovery:clear_local');
  getCartStore().setState({
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
    isSyncingShopify: false,
    quantitySyncPendingByVariantId: clearAllQuantitySyncPending(),
    hasHydrated: true,
  });
  markCartRevisionSynced('recovery:clear_local');
  resetCartPricingCacheForTests();

  logCartStateTransition('recovery:clear_local', 0, cartRevision);
  return {
    ok: true,
    message: 'Local cart storage cleared. Server cart was not changed.',
    lineCount: 0,
  };
}

/**
 * Dev/admin — GET server cart and replace the local bag with server lines exactly.
 * No reconcile POST/PATCH and no quantity merging with prior local state.
 */
export async function recoverCartApplyServerSnapshot(
  customerEmail?: string,
): Promise<CartRecoveryResult> {
  if (!isCartRecoveryEnabled()) return cartRecoveryUnauthorized();
  if (!usesKokobayCartProxy()) {
    return {
      ok: false,
      message: 'Server snapshot recovery requires the Koko Bay cart API.',
    };
  }

  cancelCartBackgroundWork();
  pendingFlushCustomerEmailAfterHydrate = undefined;

  const guestId = await loadCartGuestId();
  const snapshot = await fetchKokobayCartSnapshotReadOnly(guestId, customerEmail);
  if (!snapshot) {
    await recoverCartClearLocalStorage();
    return {
      ok: true,
      message: 'No server cart found — local storage cleared.',
      lineCount: 0,
    };
  }

  bumpCartRevision('recovery:server_snapshot');
  const localLines = getCartStore().getState().lines;
  const reconciledForRecovery = reconcileCartLinesServerAuthoritative(localLines, snapshot.lines);
  const applyResult = applyValidatedRemoteSnapshot(snapshot, {
    reconciledLines: reconciledForRecovery,
    reconciliationMode: 'server_authoritative',
    source: 'recovery:server_snapshot',
    skipDivergenceHeal: true,
  });
  if (applyResult !== 'applied') {
    return {
      ok: false,
      message: 'Could not apply server snapshot.',
      lineCount: getCartStore().getState().lines.length,
    };
  }
  await persistCartLines(getCartStore().getState().lines);
  await persistShopifyCartId(snapshot.cartId);
  markCartRevisionSynced('recovery:server_snapshot');
  resetCartPricingCacheForTests();

  const lineCount = getCartStore().getState().lines.length;
  logCartStateTransition('recovery:server_snapshot', lineCount, cartRevision, {
    cartId: snapshot.cartId,
  });
  return {
    ok: true,
    message: `Bag replaced from server (${lineCount} line${lineCount === 1 ? '' : 's'}). Quantities were not adjusted locally.`,
    lineCount,
  };
}

const CHECKOUT_SYNC_SETTLE_MS = 50;
const CHECKOUT_SYNC_MAX_WAIT_MS = 15_000;

/** True when debounced mutations have synced and a checkout URL can be trusted. */
export function isCartSettledForCheckout(): boolean {
  const { isSyncingShopify, pendingCartSync } = getCartStore().getState();
  return (
    !isSyncingShopify &&
    !pendingCartSync &&
    !isCartSyncPending() &&
    !isCartDirty()
  );
}

/** Strict checkout gate — revision clean and sync flags idle. */
export function isCartConfirmedSyncedForCheckout(): boolean {
  const { isSyncingShopify, pendingCartSync } = getCartStore().getState();
  const revision = getCartRevisionSnapshot();
  return (
    revision.cartRevision === revision.lastSyncedRevision &&
    !revision.isCartDirty &&
    !isSyncingShopify &&
    !pendingCartSync &&
    !isCartSyncPending()
  );
}

async function waitForCheckoutSyncSettled(deadlineMs: number): Promise<boolean> {
  while (Date.now() < deadlineMs) {
    if (isCartConfirmedSyncedForCheckout()) return true;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, CHECKOUT_SYNC_SETTLE_MS);
    });
  }
  return isCartConfirmedSyncedForCheckout();
}

type CheckoutRemoteReconcileFastPath = {
  skip: boolean;
  cartRevision: number;
  lastSyncedRevision: number;
  checkoutUrlPresent: boolean;
  shopifyCartIdPresent: boolean;
};

/** Skip GET /api/cart reconcile when checkout can trust the last successful sync. */
function evaluateCheckoutRemoteReconcileFastPath(): CheckoutRemoteReconcileFastPath {
  const { isSyncingShopify, pendingCartSync, shopifyCartId, storeCheckoutUrl, checkoutUrl } =
    getCartStore().getState();
  const { cartRevision: revision, lastSyncedRevision: syncedRevision, isCartDirty } =
    getCartRevisionSnapshot();
  const checkoutUrlPresent = Boolean((storeCheckoutUrl ?? checkoutUrl)?.trim());
  const shopifyCartIdPresent = Boolean(shopifyCartId?.trim());

  const skip =
    !isCartDirty &&
    revision === syncedRevision &&
    !pendingCartSync &&
    !isSyncingShopify &&
    checkoutUrlPresent &&
    shopifyCartIdPresent;

  return {
    skip,
    cartRevision: revision,
    lastSyncedRevision: syncedRevision,
    checkoutUrlPresent,
    shopifyCartIdPresent,
  };
}

/**
 * Flush debounced cart mutations and wait until Shopify sync has caught up.
 * Use before navigating to checkout so we do not open a stale checkout URL.
 */
export async function ensureCartSyncedForCheckout(customerEmail?: string): Promise<boolean> {
  if (!isRemoteCartConfigured()) return true;

  logCartTraceWithStore('checkout_sync_start', { customerEmail: customerEmail ?? null });

  const fastPath = evaluateCheckoutRemoteReconcileFastPath();
  if (fastPath.skip) {
    console.log('[CHECKOUT_FAST_PATH] skipped_remote_reconcile', {
      cartRevision: fastPath.cartRevision,
      lastSyncedRevision: fastPath.lastSyncedRevision,
      checkoutUrlPresent: fastPath.checkoutUrlPresent,
      shopifyCartIdPresent: fastPath.shopifyCartIdPresent,
    });
    logCartHealthStatus();
    logCartTraceWithStore('checkout_sync_complete', {
      ok: true,
      customerEmail: customerEmail ?? null,
      fastPath: true,
    });
    return true;
  }

  await flushCartSync({ force: true, customerEmail, reconciliationMode: 'server_authoritative' });

  let settled = await waitForCheckoutSyncSettled(Date.now() + CHECKOUT_SYNC_MAX_WAIT_MS);
  if (!settled) {
    await flushCartSync({ force: true, customerEmail, reconciliationMode: 'server_authoritative' });
    settled = await waitForCheckoutSyncSettled(Date.now() + 5_000);
  }

  await refreshStoreCheckoutUrl(customerEmail);
  logCartHealthStatus();
  logCartTraceWithStore('checkout_sync_complete', {
    ok: settled,
    customerEmail: customerEmail ?? null,
  });
  return settled;
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

async function applyRemoteCartSyncResult(
  revisionAtStart: number,
  syncGeneration: number,
  result: Awaited<ReturnType<typeof syncLocalCartToRemote>>,
  customerEmail?: string,
  options?: { reconciliationMode?: CartLineReconciliationMode },
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
    logCartTrace('remote_sync_guest_id', {
      guestId: result.guestId,
      revisionAtStart,
      syncGeneration,
    });
  }
  const snapshot = result.snapshot;
  if (!snapshot) {
    clearQuantitySyncPendingIfNeeded();
    if (!result.syncError && revisionAtStart === cartRevision) {
      markCartRevisionSynced('apply_remote_cart_sync_result_no_snapshot');
      cartSyncFollowUpPending = false;
    } else if (isCartDirty() && cartSyncRunnerInFlight) {
      cartSyncFollowUpPending = true;
    }
    return;
  }

  const localLines = getCartStore().getState().lines;
  const learnInventoryCap = result.syncError?.code === 'insufficient_inventory';
  const reconciliationMode = options?.reconciliationMode ?? activeRunReconciliationMode;
  const reconciledLines = reconcileLinesForRemoteApply(localLines, snapshot.lines, reconciliationMode, {
    syncError: Boolean(result.syncError),
    learnInventoryCap,
  });
  cartSyncTrace('apply_remote_result_reconcile', {
    reconciliationMode,
    localLineCount: localLines.length,
    remoteLineCount: snapshot.lines.length,
    reconciledLineCount: reconciledLines.length,
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
  const applyResult = applyValidatedRemoteSnapshot(snapshot, {
    reconciledLines,
    reconciliationMode,
    source: 'apply_remote_cart_sync_result',
    revisionAtStart,
    syncGeneration,
    activeSyncGeneration,
  });
  if (applyResult === 'revision_mismatch') {
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
  if (applyResult === 'rejected' || applyResult === 'stale_rejected') {
    if (isCartDirty() && cartSyncRunnerInFlight) {
      cartSyncFollowUpPending = true;
    }
    return;
  }
  await persistShopifyCartId(snapshot.cartId);
  logCartTrace('remote_sync_applied', {
    cartId: snapshot.cartId,
    guestId: result.guestId ?? null,
    revisionAtStart,
    syncGeneration,
    lineCount: snapshot.lines.length,
    syncError: result.syncError?.code ?? null,
    reconciliationMode,
  });

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
  markSyncingShopifyActive();

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

      const { lines, checkoutUrl, storeCheckoutUrl } = getCartStore().getState();
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

      await applyRemoteCartSyncResult(revisionAtStart, syncGeneration, lastResult, customerEmail, {
        reconciliationMode: 'optimistic',
      });
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
      markSyncingShopifyIdle();
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
  markSyncingShopifyActive();

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

      const lines = getCartStore().getState().lines;
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
        getCartStore().getState().storeCheckoutUrl ?? getCartStore().getState().checkoutUrl,
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
        clearQuantitySyncPendingIfNeeded();
        if (cartSyncRunnerInFlight) {
          cartSyncFollowUpPending = true;
        } else {
          scheduleSync('sync_quantity_fast:no_snapshot');
        }
        return;
      }

      await applyRemoteCartSyncResult(revisionAtStart, syncGeneration, lastResult, customerEmail, {
        reconciliationMode: 'optimistic',
      });
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
      markSyncingShopifyIdle();
    }
    finalizePendingCartSync();
  }
}

export function createSyncWithShopify(
  set: CartStore['setState'],
  get: CartStore['getState'],
): CartState['syncWithShopify'] {
  return async (customerEmail?: string) => {
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
    logCartTrace('sync_with_shopify_start', {
      guestId,
      shopifyCartId,
      lineCount: lines.length,
      revisionAtStart,
      force,
      customerEmail: customerEmail ?? null,
      linesWithShopifyIds: lines.filter((l) => l.shopifyLineId).length,
    });
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
      set((state) => ({
        shopifyCartId: null,
        ...checkoutUrlsFromValue(null),
        ...clearCartPricingFields(),
        ...emptyCartDiscountFields(),
        ...(state.isSyncingShopify ? { isSyncingShopify: false } : {}),
      }));
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
    patchCartSyncFlags({ isSyncingShopify: true, pendingCartSync: true }, set);
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
        patchCartSyncFlags({ isSyncingShopify: false }, set);
      }
      finalizePendingCartSync();
      logCartStateTransition('syncWithShopify:finished', get().lines.length, cartRevision, {
        revisionAtStart,
        durationMs: Math.round(performance.now() - syncStoreStart),
      });
      logCartTraceWithStore('sync_with_shopify_complete', {
        guestId,
        revisionAtStart,
        durationMs: Math.round(performance.now() - syncStoreStart),
      });
      cartPerfLog(
        `syncWithShopify finished in ${Math.round(performance.now() - syncStoreStart)}ms ` +
          `(revision ${revisionAtStart}→${cartRevision})`,
      );
    }
  };
}

export function getCartActionRuntime() {
  return {
    getRevision: () => cartRevision,
    bumpRevision: bumpCartRevision,
    scheduleSync,
    scheduleSnapshotRecovery,
    flushAuthoritativeCartSync,
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
    getRevisionSnapshot: getCartRevisionSnapshot,
  };
}

export {
  scheduleSync,
  scheduleFastAddSync,
  flushFastQuantitySyncForVariant,
  scheduleDebouncedQuantitySync,
  cancelQtyChangeSyncTimer,
  bumpCartRevision,
  cancelCartBackgroundWork,
  finishCartHydrationPostSync,
  markQuantitySyncPending,
  clearAllQuantitySyncPending,
  mergeSyncedCartLines,
  cartSyncScheduler,
};
