import { recordForegroundNetworkRequest } from '@/lib/foreground-perf';
import { notifyForegroundAuditTimerRegistered } from '@/lib/foreground-audit/state';
import type {
  ActiveTimerInfo,
  AppStateTransition,
  HydrationLog,
  LifecyclePerfSnapshot,
  LifecycleScreenId,
  MemorySample,
  NetworkRequestLog,
  RegisteredAppStateListener,
} from '@/lib/lifecycle-perf/types';

const MAX_TRANSITIONS = 40;
const MAX_NETWORK_LOG = 30;
const MAX_MEMORY_SAMPLES = 20;
const MAX_HYDRATION_LOG = 30;

let foregroundCycle = 0;
let currentAppState = 'active';
let nextTimerId = 1;
let nextNetworkId = 1;

const appStateTransitions: AppStateTransition[] = [];
const listeners = new Map<string, RegisteredAppStateListener>();
const activeTimers = new Map<number, ActiveTimerInfo>();
const zustandSubscribers = new Map<string, number>();
const renderCounts: Record<LifecycleScreenId, number> = {
  home: 0,
  cart: 0,
  product: 0,
  checkout: 0,
};
const hydrationEvents: HydrationLog[] = [];
const memoryHistory: MemorySample[] = [];
const networkLog: NetworkRequestLog[] = [];
let pendingNetworkRequests = 0;
let resumeNetworkTrigger: string | undefined;

export function setResumeNetworkTrigger(trigger: string | undefined): void {
  resumeNetworkTrigger = trigger;
}

export function getResumeNetworkTrigger(): string | undefined {
  return resumeNetworkTrigger;
}

export function recordAppStateTransition(from: string, to: string): void {
  currentAppState = to;
  appStateTransitions.push({ from, to, atMs: Date.now() });
  if (appStateTransitions.length > MAX_TRANSITIONS) {
    appStateTransitions.shift();
  }
  if (to === 'active' && from !== 'active') {
    foregroundCycle += 1;
  }
}

export function getForegroundCycle(): number {
  return foregroundCycle;
}

export function registerListener(id: string): void {
  const existing = listeners.get(id);
  if (existing?.active) {
    console.warn(`[lifecycle] duplicate AppState listener registration: ${id}`);
  }
  listeners.set(id, {
    id,
    registeredAtMs: Date.now(),
    active: true,
  });
}

export function unregisterListener(id: string): void {
  const entry = listeners.get(id);
  if (!entry) return;
  listeners.set(id, {
    ...entry,
    active: false,
    removedAtMs: Date.now(),
  });
}

export function registerTimer(
  kind: ActiveTimerInfo['kind'],
  delayMs: number,
  label?: string,
): number {
  const id = nextTimerId++;
  activeTimers.set(id, {
    id,
    kind,
    delayMs,
    createdAtMs: Date.now(),
    label,
  });
  notifyForegroundAuditTimerRegistered();
  return id;
}

export function unregisterTimer(id: number): void {
  activeTimers.delete(id);
}

export function incrementZustandSubscriber(storeName: string): void {
  zustandSubscribers.set(storeName, (zustandSubscribers.get(storeName) ?? 0) + 1);
}

export function decrementZustandSubscriber(storeName: string): void {
  const next = Math.max(0, (zustandSubscribers.get(storeName) ?? 1) - 1);
  zustandSubscribers.set(storeName, next);
}

export function recordRender(screen: LifecycleScreenId): void {
  renderCounts[screen] += 1;
}

export function recordHydration(store: string, skipped: boolean): void {
  hydrationEvents.push({ store, skipped, atMs: Date.now() });
  if (hydrationEvents.length > MAX_HYDRATION_LOG) hydrationEvents.shift();
}

export function networkRequestStarted(
  url: string,
  method: string,
  trigger?: string,
): number {
  pendingNetworkRequests += 1;
  const resolvedTrigger = trigger ?? resumeNetworkTrigger;
  const id = nextNetworkId++;
  const entry: NetworkRequestLog = {
    id,
    url,
    method,
    startedAtMs: Date.now(),
    trigger: resolvedTrigger,
  };
  networkLog.push(entry);
  if (networkLog.length > MAX_NETWORK_LOG) networkLog.shift();
  if (__DEV__ && resolvedTrigger === 'app_foreground') {
    recordForegroundNetworkRequest();
  }
  return id;
}

export function getRenderCountsSnapshot(): Record<LifecycleScreenId, number> {
  return { ...renderCounts };
}

export function getPendingNetworkRequestCount(): number {
  return pendingNetworkRequests;
}

export function getActiveTimerCount(): number {
  return activeTimers.size;
}

export function networkRequestCompleted(id: number): void {
  pendingNetworkRequests = Math.max(0, pendingNetworkRequests - 1);
  const entry = networkLog.find((row) => row.id === id);
  if (entry) entry.completedAtMs = Date.now();
}

export function sampleMemory(phase: string): MemorySample {
  const sample = readMemorySample(phase);
  memoryHistory.push(sample);
  if (memoryHistory.length > MAX_MEMORY_SAMPLES) memoryHistory.shift();
  return sample;
}

function readMemorySample(phase: string): MemorySample {
  const perfMemory = (
    globalThis as typeof globalThis & {
      performance?: { memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number } };
    }
  ).performance?.memory;

  const used = perfMemory?.usedJSHeapSize;
  const total = perfMemory?.totalJSHeapSize;

  return {
    phase,
    atMs: Date.now(),
    usedJsHeapMb: used != null ? Math.round(used / 1024 / 1024) : null,
    totalJsHeapMb: total != null ? Math.round(total / 1024 / 1024) : null,
  };
}

export function buildLifecyclePerfSnapshot(
  cartMetrics: { totalSyncs: number; avgSyncDurationMs: number },
): LifecyclePerfSnapshot {
  const activeListenerList = [...listeners.values()].filter((row) => row.active);

  return {
    atMs: Date.now(),
    memoryUsage: memoryHistory[memoryHistory.length - 1] ?? null,
    memoryHistory: [...memoryHistory],
    appStateTransitions: [...appStateTransitions],
    currentAppState,
    activeListeners: activeListenerList,
    activeListenerCount: activeListenerList.length,
    activeTimers: [...activeTimers.values()],
    activeTimerCount: activeTimers.size,
    zustandSubscribers: Object.fromEntries(zustandSubscribers.entries()),
    pendingNetworkRequests,
    recentNetworkRequests: [...networkLog].reverse().slice(0, 15),
    cartSyncCount: cartMetrics.totalSyncs,
    cartSyncAvgMs: cartMetrics.avgSyncDurationMs,
    renderCounts: { ...renderCounts },
    hydrationEvents: [...hydrationEvents].reverse().slice(0, 15),
    foregroundCycle,
  };
}
