const SYNC_STUCK_MS = 10_000;
const WATCHDOG_INTERVAL_MS = 2_000;

let pendingCartSyncSinceMs: number | null = null;
let syncingShopifySinceMs: number | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let onSyncTimeout: (() => void) | null = null;

type CartSyncWatchdogReaders = {
  readPendingCartSync: () => boolean;
  readIsSyncingShopify: () => boolean;
};

let readers: CartSyncWatchdogReaders = {
  readPendingCartSync: () => false,
  readIsSyncingShopify: () => false,
};

export function bindCartSyncWatchdog(
  nextReaders: CartSyncWatchdogReaders,
  timeoutHandler: () => void,
): void {
  readers = nextReaders;
  onSyncTimeout = timeoutHandler;
}

export function resetCartSyncWatchdogForTests(): void {
  pendingCartSyncSinceMs = null;
  syncingShopifySinceMs = null;
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

export function noteCartSyncPendingActive(): void {
  if (pendingCartSyncSinceMs == null) {
    pendingCartSyncSinceMs = Date.now();
  }
  armCartSyncWatchdog();
}

export function noteCartSyncPendingIdle(): void {
  pendingCartSyncSinceMs = null;
}

export function noteCartSyncingShopifyActive(): void {
  if (syncingShopifySinceMs == null) {
    syncingShopifySinceMs = Date.now();
  }
  armCartSyncWatchdog();
}

export function noteCartSyncingShopifyIdle(): void {
  syncingShopifySinceMs = null;
}

function armCartSyncWatchdog(): void {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(evaluateCartSyncWatchdog, WATCHDOG_INTERVAL_MS);
}

function evaluateCartSyncWatchdog(): void {
  const now = Date.now();
  const pending = readers.readPendingCartSync();
  const syncing = readers.readIsSyncingShopify();

  if (!pending) pendingCartSyncSinceMs = null;
  if (!syncing) syncingShopifySinceMs = null;

  const pendingStuck =
    pending &&
    pendingCartSyncSinceMs != null &&
    now - pendingCartSyncSinceMs > SYNC_STUCK_MS;
  const syncingStuck =
    syncing &&
    syncingShopifySinceMs != null &&
    now - syncingShopifySinceMs > SYNC_STUCK_MS;

  if (!pendingStuck && !syncingStuck) {
    if (!pending && !syncing && watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    return;
  }

  console.log('[CART_SYNC_TIMEOUT]', {
    pendingCartSync: pending,
    isSyncingShopify: syncing,
    pendingMs: pendingCartSyncSinceMs != null ? now - pendingCartSyncSinceMs : null,
    syncingMs: syncingShopifySinceMs != null ? now - syncingShopifySinceMs : null,
  });

  pendingCartSyncSinceMs = null;
  syncingShopifySinceMs = null;
  onSyncTimeout?.();
}

/** @internal test hook */
export function evaluateCartSyncWatchdogForTests(): void {
  evaluateCartSyncWatchdog();
}

/** @internal test hook */
export function getCartSyncWatchdogPendingSinceForTests(): number | null {
  return pendingCartSyncSinceMs;
}
