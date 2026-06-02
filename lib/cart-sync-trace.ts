/** Dev-only cart sync audit trail — filter Metro with `[cart-sync]` / `[fast_add]`. */

const FAST_ADD_FULL_SYNC_WATCH_MS = 5_000;

let fastAddWatchUntilMs = 0;

export function cartSyncTrace(label: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[cart-sync] ${label}`, detail);
    return;
  }
  console.log(`[cart-sync] ${label}`);
}

export function logCartSyncRevisionState(
  context: string,
  state: {
    isCartDirty: boolean;
    cartRevision: number;
    lastSyncedRevision: number;
  },
): void {
  if (!__DEV__) return;
  console.log('[cart_sync]', {
    context,
    isCartDirty: state.isCartDirty,
    cartRevision: state.cartRevision,
    lastSyncedRevision: state.lastSyncedRevision,
  });
}

export function logFastAddSuccess(state: {
  isCartDirty: boolean;
  cartRevision: number;
  lastSyncedRevision: number;
}): void {
  if (!__DEV__) return;
  console.log('[fast_add]', 'success');
  logCartSyncRevisionState('fast_add_complete', state);
  fastAddWatchUntilMs = Date.now() + FAST_ADD_FULL_SYNC_WATCH_MS;
}

export function noteUnexpectedFullSyncAfterFastAdd(
  caller: string,
  state: {
    isCartDirty: boolean;
    cartRevision: number;
    lastSyncedRevision: number;
    debouncePending: boolean;
  },
): void {
  if (!__DEV__) return;
  if (Date.now() > fastAddWatchUntilMs) return;

  console.warn('[fast_add] unexpected full sync within 5s of success', {
    caller,
    msRemainingOnWatch: Math.max(0, fastAddWatchUntilMs - Date.now()),
    ...state,
  });
}
