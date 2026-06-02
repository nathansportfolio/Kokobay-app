import { AppState, type AppStateStatus } from 'react-native';
import type { StoreApi } from 'zustand';

import {
  decrementZustandSubscriber,
  incrementZustandSubscriber,
  registerListener,
  registerTimer,
  unregisterListener,
  unregisterTimer,
} from '@/lib/lifecycle-perf/state';

type TimerGlobals = {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  setInterval: typeof setInterval;
  clearInterval: typeof clearInterval;
};

let timerGlobals: TimerGlobals | null = null;
let timersPatched = false;
const timeoutHandleToId = new Map<ReturnType<typeof setTimeout>, number>();
const intervalHandleToId = new Map<ReturnType<typeof setInterval>, number>();

export function installLifecycleTimerTracking(): void {
  if (!__DEV__ || timersPatched) return;

  const g = globalThis as TimerGlobals;
  timerGlobals = {
    setTimeout: g.setTimeout.bind(g),
    clearTimeout: g.clearTimeout.bind(g),
    setInterval: g.setInterval.bind(g),
    clearInterval: g.clearInterval.bind(g),
  };

  g.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    const trackId = registerTimer('timeout', delay ?? 0);
    const handle = timerGlobals!.setTimeout(() => {
      timeoutHandleToId.delete(handle);
      unregisterTimer(trackId);
      if (typeof handler === 'function') handler(...args);
    }, delay, ...args);
    timeoutHandleToId.set(handle, trackId);
    return handle;
  }) as typeof setTimeout;

  g.clearTimeout = ((handle: ReturnType<typeof setTimeout> | undefined) => {
    if (handle != null) {
      const trackId = timeoutHandleToId.get(handle);
      if (trackId != null) {
        timeoutHandleToId.delete(handle);
        unregisterTimer(trackId);
      }
    }
    return timerGlobals!.clearTimeout(handle);
  }) as typeof clearTimeout;

  g.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    const trackId = registerTimer('interval', delay ?? 0);
    const handle = timerGlobals!.setInterval(() => {
      if (typeof handler === 'function') handler(...args);
    }, delay, ...args);
    intervalHandleToId.set(handle, trackId);
    return handle;
  }) as typeof setInterval;

  g.clearInterval = ((handle: ReturnType<typeof setInterval> | undefined) => {
    if (handle != null) {
      const trackId = intervalHandleToId.get(handle);
      if (trackId != null) {
        intervalHandleToId.delete(handle);
        unregisterTimer(trackId);
      }
    }
    return timerGlobals!.clearInterval(handle);
  }) as typeof clearInterval;

  timersPatched = true;
}

export function instrumentZustandStore<T>(name: string, store: StoreApi<T>): void {
  if (!__DEV__) return;

  const originalSubscribe = store.subscribe;
  store.subscribe = ((listener: (state: T, prevState: T) => void) => {
    incrementZustandSubscriber(name);
    const unsubscribe = originalSubscribe(listener);
    return () => {
      decrementZustandSubscriber(name);
      unsubscribe();
    };
  }) as typeof store.subscribe;
}

export function registerTrackedAppStateListener(
  id: string,
  onChange: (state: AppStateStatus) => void,
): () => void {
  registerListener(id);
  const sub = AppState.addEventListener('change', onChange);
  return () => {
    sub.remove();
    unregisterListener(id);
  };
}
