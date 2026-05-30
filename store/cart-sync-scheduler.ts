/** Debounced cart sync — coalesces rapid qty changes; pauses while app is backgrounded. */

import { cartPerfLog } from '@/lib/cart-perf-log';

import type { AppLifecycle } from './cart-app-lifecycle';

export const CART_SYNC_DEBOUNCE_MS = 500;
/** Let the UI paint after foreground resume before hitting the network. */
const RESUME_SYNC_DEFER_MS = 120;

export type CartSyncRunner = (customerEmail?: string) => Promise<void>;

export type CartSyncSchedulerOptions = {
  debounceMs?: number;
  /** When false, scheduled/ resumed syncs are skipped (cart already matches server). */
  shouldSync?: () => boolean;
  lifecycle?: AppLifecycle;
};

export type CartSyncScheduler = {
  scheduleSync: () => void;
  flushSync: (customerEmail?: string) => Promise<void>;
  isDebouncePending: () => boolean;
  cancelDebounce: () => void;
  /** @internal test hook */
  _pendingRunCount: () => number;
};

export function createCartSyncScheduler(
  runSync: CartSyncRunner,
  options: CartSyncSchedulerOptions = {},
): CartSyncScheduler {
  const debounceMs = options.debounceMs ?? CART_SYNC_DEBOUNCE_MS;
  const shouldSync = options.shouldSync ?? (() => true);
  const lifecycle = options.lifecycle ?? resolveNativeAppLifecycle();

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();
  let pendingRunCount = 0;
  let lifecycleAttached = false;

  const cancelDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = undefined;
    }
  };

  const runChain = (customerEmail?: string): Promise<void> => {
    if (!lifecycle.isActive()) return chain;
    pendingRunCount += 1;
    chain = chain
      .then(async () => {
        if (!lifecycle.isActive()) return;
        await runSync(customerEmail);
      })
      .catch(() => {})
      .finally(() => {
        pendingRunCount = Math.max(0, pendingRunCount - 1);
      });
    return chain;
  };

  const fireDebounced = () => {
    debounceTimer = undefined;
    if (!shouldSync()) return;
    if (!lifecycle.isActive()) return;
    cartPerfLog(`debounce fired (${debounceMs}ms window elapsed), starting sync chain`);
    void runChain();
  };

  const armDebounce = () => {
    cancelDebounce();
    debounceTimer = setTimeout(fireDebounced, debounceMs);
  };

  const scheduleAfterResume = () => {
    if (!shouldSync()) return;
    cancelDebounce();
    resumeTimer = setTimeout(() => {
      resumeTimer = undefined;
      if (!shouldSync() || !lifecycle.isActive()) return;
      armDebounce();
    }, RESUME_SYNC_DEFER_MS);
  };

  const attachLifecycleListener = () => {
    if (lifecycleAttached) return;
    lifecycleAttached = true;
    lifecycle.onStateChange((active) => {
      if (!active) {
        cancelDebounce();
        return;
      }
      lifecycle.deferAfterInteractions(() => {
        scheduleAfterResume();
      });
    });
  };

  return {
    scheduleSync() {
      attachLifecycleListener();
      if (!shouldSync()) return;
      if (!lifecycle.isActive()) return;
      cartPerfLog(`scheduleSync armed debounce ${debounceMs}ms`);
      armDebounce();
    },

    flushSync(customerEmail?: string) {
      attachLifecycleListener();
      cancelDebounce();
      if (!lifecycle.isActive()) return chain;
      return runChain(customerEmail);
    },

    isDebouncePending() {
      return debounceTimer !== undefined || resumeTimer !== undefined;
    },

    cancelDebounce,

    _pendingRunCount() {
      return pendingRunCount;
    },
  };
}

let cachedNativeLifecycle: AppLifecycle | null = null;

function resolveNativeAppLifecycle(): AppLifecycle {
  if (cachedNativeLifecycle) return cachedNativeLifecycle;
  // Lazy — keeps node unit tests free of react-native imports.
  const mod = require('./cart-native-lifecycle') as typeof import('./cart-native-lifecycle');
  cachedNativeLifecycle = mod.nativeAppLifecycle;
  return cachedNativeLifecycle;
}
