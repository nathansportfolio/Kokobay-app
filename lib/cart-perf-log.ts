import {
  logResumeCartRefreshComplete,
  logResumeCartRefreshStart,
  logResumeCartSyncCompleted,
  logResumeCartSyncEvaluated,
  logResumeCartSyncSkipped,
  logResumeCartSyncStarted,
} from '@/lib/resume-perf';
import { recordForegroundAuditCart } from '@/lib/foreground-audit';
import { isJsFreezeAuditEnabled, isJsFreezeSessionActive, markJsFreezeTimeline } from '@/lib/js-freeze-audit';

export function cartPerfLog(message: string): void {
  if (__DEV__) console.log(`[cart] ${message}`);
}

export {
  cartSyncTrace,
  logCartStateTransition,
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
  recordForegroundAuditCart('foreground_resume_evaluated', detail);
}

export function cartResumeSyncSkipped(detail: Record<string, unknown>): void {
  logResumeCartSyncSkipped(detail);
  recordForegroundAuditCart('foreground_resume_skipped', detail);
}

export function cartResumeSyncStarted(detail: Record<string, unknown>): void {
  logResumeCartSyncStarted(detail);
  recordForegroundAuditCart('syncWithShopify', {
    reason: 'foreground_resume',
    kind: detail.kind ? String(detail.kind) : undefined,
    ...detail,
  });
  if (isJsFreezeAuditEnabled() && isJsFreezeSessionActive()) {
    markJsFreezeTimeline('cart_sync_start', detail);
  }
}

export function cartResumeSyncCompleted(detail: Record<string, unknown>): void {
  logResumeCartSyncCompleted(detail);
  recordForegroundAuditCart('syncWithShopify_complete', {
    reason: 'foreground_resume',
    kind: detail.kind ? String(detail.kind) : undefined,
    ...detail,
  });
  if (isJsFreezeAuditEnabled() && isJsFreezeSessionActive()) {
    markJsFreezeTimeline('cart_sync_end', detail);
  }
}
