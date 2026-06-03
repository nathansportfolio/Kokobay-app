import type { StoreApi } from 'zustand';

import { isJsFreezeAuditEnabled } from '@/lib/js-freeze-audit/enabled';
import { recordJsFreezeLongTask, recordJsFreezeStoreUpdate } from '@/lib/js-freeze-audit/state';

const LONG_TASK_THRESHOLD_MS = 16;

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

/** Wrap Zustand `setState` to detect synchronous JS blocks during a freeze audit session. */
export function instrumentZustandSetStateForJsFreeze<T extends object>(
  name: string,
  store: StoreApi<T>,
): void {
  if (!isJsFreezeAuditEnabled()) return;

  const originalSetState = store.setState.bind(store);
  store.setState = ((partial, replace?) => {
    const start = performance.now();
    const prev = store.getState();
    originalSetState(partial as Parameters<StoreApi<T>['setState']>[0], replace as never);
    const next = store.getState();
    const durationMs = performance.now() - start;
    const changedKeys = diffShallowKeys(next, prev);
    recordJsFreezeLongTask(`zustand.setState:${name}`, durationMs, LONG_TASK_THRESHOLD_MS);
    recordJsFreezeStoreUpdate(name, changedKeys, durationMs);
  }) as StoreApi<T>['setState'];
}
