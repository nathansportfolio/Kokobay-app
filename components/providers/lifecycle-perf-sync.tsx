import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  buildLifecyclePerfSnapshot,
  isLifecyclePerfEnabled,
  logLifecyclePerfDashboard,
  recordAppStateTransition,
  sampleMemory,
  setResumeNetworkTrigger,
} from '@/lib/lifecycle-perf';
import {
  installLifecycleTimerTracking,
  instrumentZustandStore,
  registerTrackedAppStateListener,
} from '@/lib/lifecycle-perf/install';
import { instrumentZustandSetStateForJsFreeze } from '@/lib/js-freeze-audit';
import { getCartNetworkSyncMetrics } from '@/store/cart';
import { useAuthStore, useCartStore, useMarketStore, useSearchHistoryStore } from '@/store';

const DASHBOARD_INTERVAL_MS = 15_000;
const POST_FOREGROUND_MEMORY_MS = 30_000;

function logDashboard(label: string): void {
  const snapshot = buildLifecyclePerfSnapshot(getCartNetworkSyncMetrics());
  logLifecyclePerfDashboard(snapshot);
  console.log(`[lifecycle] snapshot:${label}`, {
    memoryMb: snapshot.memoryUsage?.usedJsHeapMb ?? 'n/a',
    activeListeners: snapshot.activeListenerCount,
    listenerIds: snapshot.activeListeners.map((row) => row.id),
    activeTimers: snapshot.activeTimerCount,
    pendingNetwork: snapshot.pendingNetworkRequests,
    cartSyncs: snapshot.cartSyncCount,
    renders: snapshot.renderCounts,
    foregroundCycle: snapshot.foregroundCycle,
  });
}

/**
 * Dev-only lifecycle profiler — timer tracking, memory samples, dashboard logs.
 */
export function LifecyclePerfSync() {
  const prevStateRef = useRef<AppStateStatus>(AppState.currentState);
  const postForegroundTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!__DEV__ || !isLifecyclePerfEnabled()) return;

    installLifecycleTimerTracking();
    instrumentZustandStore('auth', useAuthStore);
    instrumentZustandStore('cart', useCartStore);
    instrumentZustandStore('market', useMarketStore);
    instrumentZustandStore('searchHistory', useSearchHistoryStore);
    instrumentZustandSetStateForJsFreeze('auth', useAuthStore);
    instrumentZustandSetStateForJsFreeze('cart', useCartStore);
    instrumentZustandSetStateForJsFreeze('market', useMarketStore);
    instrumentZustandSetStateForJsFreeze('search', useSearchHistoryStore);

    sampleMemory('install');

    const removeAppState = registerTrackedAppStateListener('lifecycle-perf-sync', (next) => {
      const prev = prevStateRef.current;
      prevStateRef.current = next;
      recordAppStateTransition(prev, next);

      if (next === 'background' || next === 'inactive') {
        setResumeNetworkTrigger(undefined);
        sampleMemory(`background:${next}`);
        logDashboard(`background:${next}`);
        if (postForegroundTimerRef.current) {
          clearTimeout(postForegroundTimerRef.current);
          postForegroundTimerRef.current = undefined;
        }
        return;
      }

      if (next === 'active' && prev !== 'active') {
        setResumeNetworkTrigger('app_foreground');
        sampleMemory('foreground');
        logDashboard('foreground');

        setTimeout(() => setResumeNetworkTrigger(undefined), 12_000);

        if (postForegroundTimerRef.current) clearTimeout(postForegroundTimerRef.current);
        postForegroundTimerRef.current = setTimeout(() => {
          postForegroundTimerRef.current = undefined;
          sampleMemory('foreground+30s');
          logDashboard('foreground+30s');
        }, POST_FOREGROUND_MEMORY_MS);
      }
    });

    const dashboardTimer = setInterval(() => {
      logDashboard('interval');
    }, DASHBOARD_INTERVAL_MS);

    logDashboard('mount');

    return () => {
      removeAppState();
      clearInterval(dashboardTimer);
      if (postForegroundTimerRef.current) clearTimeout(postForegroundTimerRef.current);
    };
  }, []);

  return null;
}
