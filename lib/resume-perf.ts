/**
 * Dev-only foreground/resume profiling — search Metro logs for `[resume]`.
 */

type ResumeMark = {
  label: string;
  atMs: number;
  detail?: Record<string, unknown>;
};

let activeRunId: string | null = null;
let runStartedAtMs = 0;
const marks: ResumeMark[] = [];

let promotionListenerCount = 0;
let promotionInvalidateCount = 0;

export function onPromotionListenerRegistered(): void {
  promotionListenerCount += 1;
  if (__DEV__) {
    logResume('promotion_listener_count', { count: promotionListenerCount });
  }
}

export function onPromotionListenerRemoved(): void {
  promotionListenerCount = Math.max(0, promotionListenerCount - 1);
  if (__DEV__) {
    logResume('promotion_listener_count', { count: promotionListenerCount });
  }
}

export function resetPromotionInvalidateCount(): void {
  promotionInvalidateCount = 0;
}

export function recordPromotionInvalidate(source: string): void {
  promotionInvalidateCount += 1;
  if (__DEV__) {
    logResume('promotion_invalidate_count', { count: promotionInvalidateCount, source });
  }
}

export function logPromotionForegroundMetrics(): void {
  if (!__DEV__) return;
  logResume('promotion_listener_count', { count: promotionListenerCount });
  logResume('promotion_invalidate_count', { count: promotionInvalidateCount });
}

function nowMs(): number {
  return Math.round(performance.now());
}

function logResume(label: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[resume] ${label}`, detail);
    return;
  }
  console.log(`[resume] ${label}`);
}

/** Begin a resume timing run when AppState becomes `active`. */
export function beginResumePerfRun(): string {
  const runId = `resume-${Date.now()}`;
  activeRunId = runId;
  runStartedAtMs = nowMs();
  marks.length = 0;
  markResumePerf('app_active');
  resetPromotionInvalidateCount();
  return runId;
}

export function markResumePerf(label: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  marks.push({ label, atMs: nowMs(), detail });
  logResume(label, detail);
}

export function logResumePerf(label: string, detail?: Record<string, unknown>): void {
  logResume(label, detail);
}

/** Wrap a named foreground handler; logs start/complete + duration_ms. */
export async function traceResumeHandler<T>(
  handlerId: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (!__DEV__) return fn();

  const start = nowMs();
  logResumePerf('handler_start', { handler: handlerId });
  try {
    return await fn();
  } finally {
    logResumePerf('handler_complete', {
      handler: handlerId,
      duration_ms: nowMs() - start,
    });
  }
}

export function traceResumeHandlerSync(handlerId: string, fn: () => void): void {
  if (!__DEV__) {
    fn();
    return;
  }
  const start = nowMs();
  logResumePerf('handler_start', { handler: handlerId });
  try {
    fn();
  } finally {
    logResumePerf('handler_complete', {
      handler: handlerId,
      duration_ms: nowMs() - start,
    });
  }
}

export function logResumeQueryRefetchStarted(queryKey: unknown): void {
  logResumePerf('query_refetch_started', { queryKey });
}

export function logResumeQueryRefetchComplete(
  queryKey: unknown,
  durationMs: number,
  responseBytes?: number,
): void {
  logResumePerf('query_refetch_complete', {
    queryKey,
    duration_ms: durationMs,
    ...(responseBytes !== undefined ? { response_bytes: responseBytes } : {}),
  });
}

export function logResumeCartRefreshStart(reason: string): void {
  logResumePerf('cart_refresh_start', { reason });
}

export function logResumeCartRefreshComplete(
  reason: string,
  durationMs: number,
  detail?: Record<string, unknown>,
): void {
  logResumePerf('cart_refresh_complete', {
    reason,
    duration_ms: durationMs,
    ...detail,
  });
}

export function logResumeCartSyncEvaluated(detail: Record<string, unknown>): void {
  logResumePerf('cart_sync_evaluated', detail);
}

export function logResumeCartSyncSkipped(detail: Record<string, unknown>): void {
  logResumePerf('cart_sync_skipped', detail);
}

export function logResumeCartSyncStarted(detail: Record<string, unknown>): void {
  logResumePerf('cart_sync_started', detail);
}

export function logResumeCartSyncCompleted(detail: Record<string, unknown>): void {
  logResumePerf('cart_sync_completed', detail);
}

export async function traceSecureStoreRead<T>(
  op: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!__DEV__) return fn();
  const start = nowMs();
  logResumePerf('secure_store_read_start', { op });
  try {
    return await fn();
  } finally {
    logResumePerf('secure_store_read_complete', {
      op,
      duration_ms: nowMs() - start,
    });
  }
}

/** Log deltas between marks for the active run. */
export function finishResumePerfRun(runId: string): void {
  if (!__DEV__) return;
  if (activeRunId !== runId) return;

  const summary: Record<string, number> = {};
  let prev = marks[0]?.atMs ?? runStartedAtMs;
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    if (!mark) continue;
    summary[mark.label] = i === 0 ? 0 : mark.atMs - prev;
    prev = mark.atMs;
  }
  const totalMs =
    marks.length > 0 ? (marks[marks.length - 1]!.atMs - runStartedAtMs) : 0;

  logResumePerf('duration_ms', { total_tracked_ms: totalMs, marks: summary });

  activeRunId = null;
  marks.length = 0;
}

export function getResumeTrackedHandlerMs(): number {
  if (!__DEV__ || marks.length === 0) return 0;
  const last = marks[marks.length - 1];
  return last ? last.atMs - runStartedAtMs : 0;
}
