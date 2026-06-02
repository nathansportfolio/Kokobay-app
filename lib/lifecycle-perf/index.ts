export type {
  LifecyclePerfSnapshot,
  LifecycleScreenId,
} from '@/lib/lifecycle-perf/types';

export {
  buildLifecyclePerfSnapshot,
  getActiveTimerCount,
  getForegroundCycle,
  getPendingNetworkRequestCount,
  getRenderCountsSnapshot,
  getResumeNetworkTrigger,
  networkRequestCompleted,
  networkRequestStarted,
  recordAppStateTransition,
  recordHydration,
  recordRender,
  sampleMemory,
  setResumeNetworkTrigger,
} from '@/lib/lifecycle-perf/state';

export {
  installLifecycleTimerTracking,
  instrumentZustandStore,
  registerTrackedAppStateListener,
} from '@/lib/lifecycle-perf/install';

export function logLifecyclePerfDashboard(
  snapshot: import('@/lib/lifecycle-perf/types').LifecyclePerfSnapshot,
): void {
  if (!__DEV__) return;
  console.log('[lifecycle] dashboard', snapshot);
}
