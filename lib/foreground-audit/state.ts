import { isForegroundAuditEnabled } from '@/lib/foreground-audit/enabled';
import { classifyForegroundNetworkSource } from '@/lib/foreground-audit/network-source';
import type {
  ForegroundCartEntry,
  ForegroundNetworkEntry,
  ForegroundQueryEntry,
  ForegroundRenderCounts,
  ForegroundRenderLabel,
  ForegroundStoreEntry,
  ForegroundTransition,
} from '@/lib/foreground-audit/types';
import { emptyForegroundRenderCounts, FOREGROUND_RENDER_LABELS } from '@/lib/foreground-audit/types';

const AUDIT_WINDOW_MS = 15_000;

type AuditSession = {
  cycle: number;
  transition: ForegroundTransition;
  startedAtPerfMs: number;
  startedAtEpochMs: number;
  timerBaseline: number;
  timersCreated: number;
  firstTimerDelayMs: number | null;
  interactionsCompleteMs: number | null;
  network: ForegroundNetworkEntry[];
  queries: ForegroundQueryEntry[];
  storeUpdates: ForegroundStoreEntry[];
  cartEvents: ForegroundCartEntry[];
  renderCounts: ForegroundRenderCounts;
};

let cycleCounter = 0;
let activeSession: AuditSession | null = null;
let finishTimer: ReturnType<typeof setTimeout> | undefined;

function logForeground(message: string, detail?: Record<string, unknown>): void {
  if (!isForegroundAuditEnabled()) return;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[FOREGROUND] ${message}`, detail);
    return;
  }
  console.log(`[FOREGROUND] ${message}`);
}

function logForegroundNetwork(entry: ForegroundNetworkEntry): void {
  if (!isForegroundAuditEnabled()) return;
  console.log(
    `[FOREGROUND_NETWORK] url=${entry.url} duration=${Math.round(entry.durationMs)} source=${entry.source} method=${entry.method}`,
  );
}

function logForegroundQuery(entry: ForegroundQueryEntry): void {
  if (!isForegroundAuditEnabled()) return;
  console.log(
    `[FOREGROUND_QUERY] key=${entry.key} refetch=${entry.refetch} duration=${Math.round(entry.durationMs)} reason=${entry.reason}`,
  );
}

function logStoreUpdate(store: string, changedKeys: string[]): void {
  if (!isForegroundAuditEnabled()) return;
  console.log(`[STORE_UPDATE] store=${store} changedKeys=[${changedKeys.join(', ')}]`);
}

function logCartResume(entry: ForegroundCartEntry): void {
  if (!isForegroundAuditEnabled()) return;
  const parts = [
    `[CART_RESUME] event=${entry.event}`,
    entry.reason ? `reason=${entry.reason}` : null,
    entry.kind ? `kind=${entry.kind}` : null,
  ].filter(Boolean);
  if (entry.detail && Object.keys(entry.detail).length > 0) {
    console.log(parts.join(' '), entry.detail);
    return;
  }
  console.log(parts.join(' '));
}

export function isForegroundAuditWindowActive(): boolean {
  return activeSession != null;
}

export function beginForegroundAudit(input: {
  transition: ForegroundTransition;
  timerBaseline: number;
}): void {
  if (!isForegroundAuditEnabled()) return;

  if (finishTimer) {
    clearTimeout(finishTimer);
    finishTimer = undefined;
  }

  cycleCounter += 1;
  activeSession = {
    cycle: cycleCounter,
    transition: input.transition,
    startedAtPerfMs: performance.now(),
    startedAtEpochMs: Date.now(),
    timerBaseline: input.timerBaseline,
    timersCreated: 0,
    firstTimerDelayMs: null,
    interactionsCompleteMs: null,
    network: [],
    queries: [],
    storeUpdates: [],
    cartEvents: [],
    renderCounts: emptyForegroundRenderCounts(),
  };

  logForeground('appState=active', {
    timestamp: new Date(activeSession.startedAtEpochMs).toISOString(),
    transition: input.transition,
    cycle: activeSession.cycle,
  });

  finishTimer = setTimeout(() => {
    finishTimer = undefined;
  }, AUDIT_WINDOW_MS);
}

export function recordForegroundTransition(from: string, to: string): void {
  if (!isForegroundAuditEnabled() || to !== 'active' || from === 'active') return;
  const transition: ForegroundTransition =
    from === 'background' ? 'background->active' : 'inactive->active';
  logForeground('transition', { from, to, transition });
}

export function recordForegroundJsResponsivenessStart(): number {
  if (!isForegroundAuditEnabled()) return performance.now();
  const start = performance.now();

  setTimeout(() => {
    if (!activeSession) return;
    const delay = Math.round(performance.now() - start);
    activeSession.firstTimerDelayMs = delay;
    logForeground('first_timer_delay', { ms: delay });
  }, 0);

  return start;
}

export function recordForegroundInteractionsComplete(startedAtPerfMs: number): void {
  if (!isForegroundAuditEnabled() || !activeSession) return;
  const ms = Math.round(performance.now() - startedAtPerfMs);
  activeSession.interactionsCompleteMs = ms;
  logForeground('interactions_complete', { ms });
}

export function recordForegroundAuditNetwork(
  url: string,
  durationMs: number,
  method: string,
): void {
  if (!isForegroundAuditEnabled() || !activeSession) return;
  const entry: ForegroundNetworkEntry = {
    url,
    method: method.toUpperCase(),
    durationMs,
    source: classifyForegroundNetworkSource(url),
  };
  activeSession.network.push(entry);
  logForegroundNetwork(entry);
}

export function recordForegroundAuditQuery(
  queryKey: unknown,
  durationMs: number,
  reason: string,
): void {
  if (!isForegroundAuditEnabled() || !activeSession) return;
  const key = safeQueryKeyLabel(queryKey);
  const entry: ForegroundQueryEntry = {
    key,
    refetch: true,
    durationMs,
    reason,
  };
  activeSession.queries.push(entry);
  logForegroundQuery(entry);
}

export function recordForegroundAuditStoreUpdate(store: string, changedKeys: string[]): void {
  if (!isForegroundAuditEnabled() || !activeSession || changedKeys.length === 0) return;
  activeSession.storeUpdates.push({
    store,
    changedKeys,
    atMs: Date.now(),
  });
  logStoreUpdate(store, changedKeys);
}

export function recordForegroundAuditCart(
  event: string,
  detail?: { reason?: string; kind?: string; [key: string]: unknown },
): void {
  if (!isForegroundAuditEnabled() || !activeSession) return;
  const { reason, kind, ...rest } = detail ?? {};
  const entry: ForegroundCartEntry = {
    event,
    reason,
    kind,
    detail: Object.keys(rest).length > 0 ? rest : undefined,
    atMs: Date.now(),
  };
  activeSession.cartEvents.push(entry);
  logCartResume(entry);
}

export function recordForegroundAuditRender(label: ForegroundRenderLabel): void {
  if (!isForegroundAuditEnabled() || !activeSession) return;
  activeSession.renderCounts[label] += 1;
}

export function notifyForegroundAuditTimerRegistered(): void {
  if (!isForegroundAuditEnabled() || !activeSession) return;
  activeSession.timersCreated += 1;
}

function safeQueryKeyLabel(queryKey: unknown): string {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return String(queryKey);
  }
}

function networkTotalsBySource(
  entries: ForegroundNetworkEntry[],
): Record<string, { count: number; totalMs: number; maxMs: number; maxUrl: string }> {
  const totals: Record<string, { count: number; totalMs: number; maxMs: number; maxUrl: string }> =
    {};
  for (const entry of entries) {
    const bucket = totals[entry.source] ?? {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      maxUrl: entry.url,
    };
    bucket.count += 1;
    bucket.totalMs += entry.durationMs;
    if (entry.durationMs >= bucket.maxMs) {
      bucket.maxMs = entry.durationMs;
      bucket.maxUrl = entry.url;
    }
    totals[entry.source] = bucket;
  }
  return totals;
}

function mostUpdatedStore(
  entries: ForegroundStoreEntry[],
): { store: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.store, (counts.get(entry.store) ?? 0) + 1);
  }
  let best: { store: string; count: number } | null = null;
  for (const [store, count] of counts) {
    if (!best || count > best.count) best = { store, count };
  }
  return best;
}

function topRenderComponent(counts: ForegroundRenderCounts): {
  label: ForegroundRenderLabel;
  count: number;
} | null {
  let best: { label: ForegroundRenderLabel; count: number } | null = null;
  for (const label of FOREGROUND_RENDER_LABELS) {
    const count = counts[label];
    if (count <= 0) continue;
    if (!best || count > best.count) best = { label, count };
  }
  return best;
}

export function finishForegroundAuditSummary(input: { activeTimerCount: number }): void {
  if (!isForegroundAuditEnabled() || !activeSession) return;

  const session = activeSession;
  activeSession = null;

  const networkTotals = networkTotalsBySource(session.network);
  const slowestNetwork = session.network.reduce<ForegroundNetworkEntry | null>(
    (best, row) => (!best || row.durationMs > best.durationMs ? row : best),
    null,
  );
  const slowestQuery = session.queries.reduce<ForegroundQueryEntry | null>(
    (best, row) => (!best || row.durationMs > best.durationMs ? row : best),
    null,
  );
  const cartSyncs = session.cartEvents.filter((row) =>
    ['scheduleSync', 'syncWithShopify', 'syncAddFast', 'syncQuantityFast', 'resolveCartSyncKind'].includes(
      row.event,
    ),
  );
  const mostRendered = topRenderComponent(session.renderCounts);
  const mostUpdated = mostUpdatedStore(session.storeUpdates);
  const jsBlockMs = session.interactionsCompleteMs ?? session.firstTimerDelayMs;

  console.log('[FOREGROUND_NETWORK_TOTALS]', networkTotals);
  console.log('[FOREGROUND_RENDER_SUMMARY]', session.renderCounts);
  console.log('[FOREGROUND_TIMERS]', {
    before: session.timerBaseline,
    after: input.activeTimerCount,
    created_during_window: session.timersCreated,
  });

  console.log('[FOREGROUND_SUMMARY]', {
    js_block_ms: jsBlockMs,
    first_timer_delay_ms: session.firstTimerDelayMs,
    interactions_complete_ms: session.interactionsCompleteMs,
    network_requests: session.network.length,
    query_refetches: session.queries.length,
    cart_syncs: cartSyncs.length,
    store_updates: session.storeUpdates.length,
    render_counts: session.renderCounts,
    active_timers: input.activeTimerCount,
    transition: session.transition,
    cycle: session.cycle,
    largest_js_stall_ms: jsBlockMs,
    most_expensive_network: slowestNetwork
      ? {
          url: slowestNetwork.url,
          duration_ms: Math.round(slowestNetwork.durationMs),
          source: slowestNetwork.source,
        }
      : null,
    slowest_query: slowestQuery
      ? {
          key: slowestQuery.key,
          duration_ms: Math.round(slowestQuery.durationMs),
          reason: slowestQuery.reason,
        }
      : null,
    most_rendered_component: mostRendered,
    most_updated_store: mostUpdated,
    network_by_source: networkTotals,
  });
}

export function resetForegroundAuditSession(): void {
  activeSession = null;
  if (finishTimer) {
    clearTimeout(finishTimer);
    finishTimer = undefined;
  }
}

export const FOREGROUND_AUDIT_WINDOW_MS = AUDIT_WINDOW_MS;
