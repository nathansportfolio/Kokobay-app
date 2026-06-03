import type { StoreApi } from 'zustand';

import {
  recordForegroundAuditStoreUpdate,
  resetForegroundAuditSession,
} from '@/lib/foreground-audit/state';

type StoreWatcher = {
  unsubscribe: () => void;
};

let watchers: StoreWatcher[] = [];

function diffShallowKeys(next: object, prev: object): string[] {
  const keys = new Set([...Object.keys(next), ...Object.keys(prev)]);
  const changed: string[] = [];
  for (const key of keys) {
    if ((next as Record<string, unknown>)[key] !== (prev as Record<string, unknown>)[key]) {
      changed.push(key);
    }
  }
  return changed;
}

function watchZustandStore<T extends object>(name: string, store: StoreApi<T>): StoreWatcher {
  const unsubscribe = store.subscribe((state, prevState) => {
    const changedKeys = diffShallowKeys(state, prevState);
    recordForegroundAuditStoreUpdate(name, changedKeys);
  });
  return { unsubscribe };
}

/** Subscribe to key stores for the foreground audit window (15s). */
export function attachForegroundAuditStoreWatchers(): void {
  detachForegroundAuditStoreWatchers();
  // Lazy import avoids a store ↔ foreground-audit require cycle at module load.
  const { useAuthStore, useCartStore, useMarketStore, useSearchHistoryStore } =
    require('@/store') as typeof import('@/store');
  watchers = [
    watchZustandStore('cart', useCartStore),
    watchZustandStore('auth', useAuthStore),
    watchZustandStore('market', useMarketStore),
    watchZustandStore('search', useSearchHistoryStore),
  ];
}

export function detachForegroundAuditStoreWatchers(): void {
  for (const watcher of watchers) watcher.unsubscribe();
  watchers = [];
}

export function cleanupForegroundAuditWatchers(): void {
  detachForegroundAuditStoreWatchers();
  resetForegroundAuditSession();
}
