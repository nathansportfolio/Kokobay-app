/** Debounced cart sync — coalesces rapid qty changes; pauses while app is backgrounded. */

import { cartPerfLog } from '@/lib/cart-perf-log';
import { recordForegroundAuditCart } from '@/lib/foreground-audit';
import { registerTrackedAppStateListener } from '@/lib/lifecycle-perf/install';

import type { AppLifecycle } from './cart-app-lifecycle';

export const CART_SYNC_DEBOUNCE_MS = 500;
/** Let the UI paint after foreground resume before hitting the network. */
const RESUME_SYNC_DEFER_MS = 120;

export type CartSyncRunner = (customerEmail?: string) => Promise<void>;

export type CartSyncArmReason = 'debounce' | 'foreground_resume' | 'flush';

export type CartSyncSchedulerOptions = {
  debounceMs?: number;
  /** When false, scheduled/ resumed syncs are skipped (cart already matches server). */
  shouldSync?: () => boolean;
  /** Foreground resume gate — return false to skip resume debounce/network. */
  shouldForegroundResume?: () => boolean;
  /** Called when a debounced or resume sync is armed (before the timer fires). */
  onSyncArm?: (reason: CartSyncArmReason) => void;
  lifecycle?: AppLifecycle;
  /** Dev lifecycle perf — unique AppState listener id. */
  lifecycleListenerId?: string;
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
  const shouldForegroundResume = options.shouldForegroundResume ?? (() => true);
  const onSyncArm = options.onSyncArm;
  const lifecycle = options.lifecycle ?? resolveNativeAppLifecycle();
  const lifecycleListenerId = options.lifecycleListenerId;

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<void> = Promise.resolve();
  let pendingRunCount = 0;
  let lifecycleAttached = false;
  let removeLifecycleListener: (() => void) | undefined;

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

  const armDebounce = (reason: CartSyncArmReason) => {
    onSyncArm?.(reason);
    cancelDebounce();
    debounceTimer = setTimeout(fireDebounced, debounceMs);
  };

  const scheduleAfterResume = () => {
    if (!shouldForegroundResume()) return;
    if (!shouldSync()) return;
    recordForegroundAuditCart('scheduleSync', { reason: 'foreground_resume', kind: 'deferred' });
    cancelDebounce();
    resumeTimer = setTimeout(() => {
      resumeTimer = undefined;
      if (!lifecycle.isActive()) return;
      if (!shouldForegroundResume()) return;
      if (!shouldSync()) return;
      armDebounce('foreground_resume');
    }, RESUME_SYNC_DEFER_MS);
  };

  const attachLifecycleListener = () => {
    if (lifecycleAttached) return;
    lifecycleAttached = true;

    const onActiveChange = (active: boolean) => {
      if (!active) {
        cancelDebounce();
        return;
      }
      lifecycle.deferAfterInteractions(() => {
        scheduleAfterResume();
      });
    };

    if (__DEV__ && lifecycleListenerId) {
      removeLifecycleListener = registerTrackedAppStateListener(lifecycleListenerId, (state) => {
        onActiveChange(state === 'active');
      });
      return;
    }

    lifecycle.onStateChange(onActiveChange);
  };

  return {
    scheduleSync() {
      attachLifecycleListener();
      if (!shouldSync()) return;
      if (!lifecycle.isActive()) return;
      cartPerfLog(`scheduleSync armed debounce ${debounceMs}ms`);
      armDebounce('debounce');
    },

    flushSync(customerEmail?: string) {
      attachLifecycleListener();
      onSyncArm?.('flush');
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
