/**
 * Dev-only foreground resume metrics — paired with `[resume]` run lifecycle.
 */

import type { LifecycleScreenId } from '@/lib/lifecycle-perf/types';

type RenderCountSnapshot = Record<LifecycleScreenId, number>;

type ForegroundBaseline = {
  startedAtMs: number;
  renderCounts: RenderCountSnapshot;
  activeTimerCount: number;
  pendingNetworkRequests: number;
};

let baseline: ForegroundBaseline | null = null;
let foregroundNetworkRequestCount = 0;
let jsInteractionsIdleAtMs: number | null = null;

function emptyRenderCounts(): RenderCountSnapshot {
  return { home: 0, cart: 0, product: 0, checkout: 0 };
}

/** Capture baseline at foreground (before handlers run). */
export function beginForegroundPerfBaseline(input: {
  renderCounts: RenderCountSnapshot;
  activeTimerCount: number;
  pendingNetworkRequests: number;
}): void {
  if (!__DEV__) return;
  baseline = {
    startedAtMs: Math.round(performance.now()),
    renderCounts: { ...input.renderCounts },
    activeTimerCount: input.activeTimerCount,
    pendingNetworkRequests: input.pendingNetworkRequests,
  };
  foregroundNetworkRequestCount = 0;
  jsInteractionsIdleAtMs = null;
}

export function recordForegroundNetworkRequest(): void {
  if (!__DEV__ || !baseline) return;
  foregroundNetworkRequestCount += 1;
}

export function markForegroundInteractionsIdle(): void {
  if (!__DEV__ || !baseline) return;
  jsInteractionsIdleAtMs = Math.round(performance.now());
}

export function finishForegroundPerfSummary(input: {
  renderCounts: RenderCountSnapshot;
  activeTimerCount: number;
  pendingNetworkRequests: number;
  trackedHandlerMs: number;
}): void {
  if (!__DEV__ || !baseline) return;

  const now = Math.round(performance.now());
  const renderDelta: Partial<Record<LifecycleScreenId, number>> = {};
  for (const screen of Object.keys(baseline.renderCounts) as LifecycleScreenId[]) {
    const delta = input.renderCounts[screen] - baseline.renderCounts[screen];
    if (delta !== 0) renderDelta[screen] = delta;
  }

  const jsThreadMs =
    jsInteractionsIdleAtMs != null
      ? jsInteractionsIdleAtMs - baseline.startedAtMs
      : null;

  console.log('[resume] foreground_summary', {
    foreground_duration_ms: now - baseline.startedAtMs,
    network_requests_on_foreground: foregroundNetworkRequestCount,
    js_interactions_idle_ms: jsThreadMs,
    tracked_handler_work_ms: input.trackedHandlerMs,
    render_count_delta: renderDelta,
    active_timers_delta: input.activeTimerCount - baseline.activeTimerCount,
    pending_network_delta: input.pendingNetworkRequests - baseline.pendingNetworkRequests,
  });

  baseline = null;
  foregroundNetworkRequestCount = 0;
  jsInteractionsIdleAtMs = null;
}

export function resetForegroundPerfBaseline(): void {
  baseline = null;
  foregroundNetworkRequestCount = 0;
  jsInteractionsIdleAtMs = null;
}

export function getEmptyRenderCounts(): RenderCountSnapshot {
  return emptyRenderCounts();
}
