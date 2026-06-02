export type LifecycleScreenId = 'home' | 'cart' | 'product' | 'checkout';

export type AppStateTransition = {
  from: string;
  to: string;
  atMs: number;
};

export type RegisteredAppStateListener = {
  id: string;
  registeredAtMs: number;
  removedAtMs?: number;
  active: boolean;
};

export type ActiveTimerInfo = {
  id: number;
  kind: 'timeout' | 'interval';
  delayMs: number;
  createdAtMs: number;
  label?: string;
};

export type NetworkRequestLog = {
  id: number;
  url: string;
  method: string;
  startedAtMs: number;
  completedAtMs?: number;
  trigger?: string;
};

export type HydrationLog = {
  store: string;
  atMs: number;
  skipped: boolean;
};

export type MemorySample = {
  atMs: number;
  phase: string;
  usedJsHeapMb: number | null;
  totalJsHeapMb: number | null;
};

export type LifecyclePerfSnapshot = {
  atMs: number;
  memoryUsage: MemorySample | null;
  memoryHistory: MemorySample[];
  appStateTransitions: AppStateTransition[];
  currentAppState: string;
  activeListeners: RegisteredAppStateListener[];
  activeListenerCount: number;
  activeTimers: ActiveTimerInfo[];
  activeTimerCount: number;
  zustandSubscribers: Record<string, number>;
  pendingNetworkRequests: number;
  recentNetworkRequests: NetworkRequestLog[];
  cartSyncCount: number;
  cartSyncAvgMs: number;
  renderCounts: Record<LifecycleScreenId, number>;
  hydrationEvents: HydrationLog[];
  foregroundCycle: number;
};
