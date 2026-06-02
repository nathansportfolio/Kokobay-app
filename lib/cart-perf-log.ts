import {
  logResumeCartRefreshComplete,
  logResumeCartRefreshStart,
  logResumeCartSyncCompleted,
  logResumeCartSyncEvaluated,
  logResumeCartSyncSkipped,
  logResumeCartSyncStarted,
} from '@/lib/resume-perf';

export function cartPerfLog(message: string): void {
  if (__DEV__) console.log(`[cart] ${message}`);
}

export {
  cartSyncTrace,
  logCartSyncRevisionState,
  logFastAddSuccess,
  noteUnexpectedFullSyncAfterFastAdd,
} from '@/lib/cart-sync-trace';

export function cartFlowLog(_method: string, _path: string, _durationMs: number): void {}

export function cartResumeRefreshStart(reason: string): void {
  logResumeCartRefreshStart(reason);
}

export function cartResumeRefreshComplete(
  reason: string,
  durationMs: number,
  detail?: Record<string, unknown>,
): void {
  logResumeCartRefreshComplete(reason, durationMs, detail);
}

export function cartResumeSyncEvaluated(detail: Record<string, unknown>): void {
  logResumeCartSyncEvaluated(detail);
}

export function cartResumeSyncSkipped(detail: Record<string, unknown>): void {
  logResumeCartSyncSkipped(detail);
}

export function cartResumeSyncStarted(detail: Record<string, unknown>): void {
  logResumeCartSyncStarted(detail);
}

export function cartResumeSyncCompleted(detail: Record<string, unknown>): void {
  logResumeCartSyncCompleted(detail);
}
