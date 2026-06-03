import { isJsFreezeAuditEnabled } from '@/lib/js-freeze-audit/enabled';
import type {
  JsFreezeRenderStormLabel,
  LongTaskEntry,
  ResumeTimelineEvent,
  StoreUpdateEntry,
} from '@/lib/js-freeze-audit/types';
import { JS_FREEZE_RENDER_STORM_LABELS } from '@/lib/js-freeze-audit/types';

function productCardStormTrace() {
  return require('@/lib/product-card-storm-trace') as typeof import('@/lib/product-card-storm-trace');
}

export const JS_FREEZE_REPORT_WINDOW_MS = 15_000;
export const JS_FREEZE_RENDER_STORM_WINDOW_MS = 10_000;
export const JS_FREEZE_RENDER_STORM_THRESHOLD = 20;
export const JS_FREEZE_EVENT_LOOP_INTERVAL_MS = 100;
export const JS_FREEZE_LAG_LOG_THRESHOLD_MS = 100;
export const JS_FREEZE_LAG_BUCKETS_MS = [100, 250, 500, 1000] as const;

type JsFreezeSession = {
  startedAtPerfMs: number;
  maxEventLoopLagMs: number;
  longTasks: LongTaskEntry[];
  storeUpdates: StoreUpdateEntry[];
  renderCounts: Record<JsFreezeRenderStormLabel, number>;
  renderStormsLogged: Set<JsFreezeRenderStormLabel>;
  timeline: Array<{ event: ResumeTimelineEvent; msSinceResume: number; detail?: Record<string, unknown> }>;
};

let activeSession: JsFreezeSession | null = null;
let eventLoopTimer: ReturnType<typeof setInterval> | undefined;
let nextEventLoopDeadlineMs = 0;

function msSinceResume(): number {
  if (!activeSession) return 0;
  return Math.round(performance.now() - activeSession.startedAtPerfMs);
}

function logJsFreeze(message: string, detail?: Record<string, unknown>): void {
  if (!isJsFreezeAuditEnabled()) return;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[JS_FREEZE] ${message}`, detail);
    return;
  }
  console.log(`[JS_FREEZE] ${message}`);
}

export function isJsFreezeSessionActive(): boolean {
  return activeSession != null;
}

function emptyRenderCounts(): Record<JsFreezeRenderStormLabel, number> {
  return {
    ProductCard: 0,
    Home: 0,
    Product: 0,
    Cart: 0,
    CheckoutBar: 0,
    BottomTabs: 0,
  };
}

export function beginJsFreezeSession(): void {
  if (!isJsFreezeAuditEnabled()) return;

  stopJsFreezeEventLoopMonitor();

  activeSession = {
    startedAtPerfMs: performance.now(),
    maxEventLoopLagMs: 0,
    longTasks: [],
    storeUpdates: [],
    renderCounts: emptyRenderCounts(),
    renderStormsLogged: new Set(),
    timeline: [],
  };

  markJsFreezeTimeline('resume_start');
  startJsFreezeEventLoopMonitor();
  productCardStormTrace().resetProductCardStormTrace();
}

export function stopJsFreezeSession(): void {
  stopJsFreezeEventLoopMonitor();
  activeSession = null;
}

function startJsFreezeEventLoopMonitor(): void {
  nextEventLoopDeadlineMs = performance.now() + JS_FREEZE_EVENT_LOOP_INTERVAL_MS;
  eventLoopTimer = setInterval(() => {
    if (!activeSession) return;

    const now = performance.now();
    const lagMs = now - nextEventLoopDeadlineMs;
    nextEventLoopDeadlineMs = now + JS_FREEZE_EVENT_LOOP_INTERVAL_MS;

    if (lagMs <= JS_FREEZE_LAG_LOG_THRESHOLD_MS) return;

    const roundedLag = Math.round(lagMs);
    if (roundedLag > activeSession.maxEventLoopLagMs) {
      activeSession.maxEventLoopLagMs = roundedLag;
    }

    const crossedBuckets = JS_FREEZE_LAG_BUCKETS_MS.filter((bucket) => lagMs >= bucket);
    for (const bucket of crossedBuckets) {
      logJsFreeze(`lag_ms=${roundedLag}`, { threshold_ms: bucket });
    }
  }, JS_FREEZE_EVENT_LOOP_INTERVAL_MS);
}

function stopJsFreezeEventLoopMonitor(): void {
  if (eventLoopTimer) {
    clearInterval(eventLoopTimer);
    eventLoopTimer = undefined;
  }
}

export function recordJsFreezeLongTask(
  name: string,
  durationMs: number,
  thresholdMs: number,
): void {
  if (!isJsFreezeAuditEnabled() || !activeSession) return;
  if (durationMs <= thresholdMs) return;

  const entry: LongTaskEntry = {
    name,
    durationMs: Math.round(durationMs),
  };
  activeSession.longTasks.push(entry);
  console.log(`[LONG_TASK] name=${entry.name} duration_ms=${entry.durationMs}`);
}

export function markJsFreezeTimeline(
  event: ResumeTimelineEvent,
  detail?: Record<string, unknown>,
): void {
  if (!isJsFreezeAuditEnabled() || !activeSession) return;

  const elapsed = msSinceResume();
  activeSession.timeline.push({ event, msSinceResume: elapsed, detail });
  console.log(`[RESUME_TIMELINE] event=${event} ms_since_resume=${elapsed}`, detail ?? {});
}

export function recordJsFreezeStoreUpdate(
  store: string,
  changedKeys: string[],
  durationMs: number,
): void {
  if (!isJsFreezeAuditEnabled() || !activeSession || changedKeys.length === 0) return;

  activeSession.storeUpdates.push({
    store,
    changedKeys,
    durationMs: Math.round(durationMs),
  });
  markJsFreezeTimeline('store_update', { store, changedKeys });
}

export function recordJsFreezeRender(label: JsFreezeRenderStormLabel): void {
  if (!isJsFreezeAuditEnabled() || !activeSession) return;

  const elapsed = performance.now() - activeSession.startedAtPerfMs;
  if (elapsed > JS_FREEZE_RENDER_STORM_WINDOW_MS) return;

  activeSession.renderCounts[label] += 1;
  const count = activeSession.renderCounts[label];

  if (
    count > JS_FREEZE_RENDER_STORM_THRESHOLD &&
    !activeSession.renderStormsLogged.has(label)
  ) {
    activeSession.renderStormsLogged.add(label);
    console.log('[RENDER_STORM]', {
      component: label,
      renders: count,
      threshold: JS_FREEZE_RENDER_STORM_THRESHOLD,
      window_ms: JS_FREEZE_RENDER_STORM_WINDOW_MS,
    });
    if (label === 'ProductCard') {
      productCardStormTrace().emitProductCardStormReport('render_storm');
    }
  }
}

export function finishJsFreezeReport(): void {
  if (!isJsFreezeAuditEnabled() || !activeSession) return;

  const session = activeSession;
  productCardStormTrace().emitProductCardStormReport('freeze_report');
  stopJsFreezeSession();

  const slowestTask = session.longTasks.reduce<LongTaskEntry | null>(
    (best, row) => (!best || row.durationMs > best.durationMs ? row : best),
    null,
  );

  const largestStoreUpdate = session.storeUpdates.reduce<StoreUpdateEntry | null>(
    (best, row) => (!best || row.durationMs > best.durationMs ? row : best),
    null,
  );

  let mostRendered: { component: JsFreezeRenderStormLabel; count: number } | null = null;
  let totalRenders = 0;
  for (const label of JS_FREEZE_RENDER_STORM_LABELS) {
    const count = session.renderCounts[label];
    totalRenders += count;
    if (count <= 0) continue;
    if (!mostRendered || count > mostRendered.count) {
      mostRendered = { component: label, count };
    }
  }

  console.log('[FREEZE_REPORT]', {
    max_event_loop_lag_ms: session.maxEventLoopLagMs,
    total_long_tasks: session.longTasks.length,
    slowest_task: slowestTask,
    most_rendered_component: mostRendered,
    total_renders: totalRenders,
    render_counts: session.renderCounts,
    render_storms: [...session.renderStormsLogged],
    largest_store_update: largestStoreUpdate,
    timeline: session.timeline,
  });
}
