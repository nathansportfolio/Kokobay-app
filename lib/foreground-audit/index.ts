export { isForegroundAuditEnabled } from '@/lib/foreground-audit/enabled';
export { classifyForegroundNetworkSource } from '@/lib/foreground-audit/network-source';
export type {
  ForegroundNetworkSource,
} from '@/lib/foreground-audit/network-source';
export type {
  ForegroundRenderLabel,
  ForegroundTransition,
} from '@/lib/foreground-audit/types';
export {
  attachForegroundAuditStoreWatchers,
  cleanupForegroundAuditWatchers,
  detachForegroundAuditStoreWatchers,
} from '@/lib/foreground-audit/store-watchers';
export {
  beginForegroundAudit,
  finishForegroundAuditSummary,
  FOREGROUND_AUDIT_WINDOW_MS,
  isForegroundAuditWindowActive,
  notifyForegroundAuditTimerRegistered,
  recordForegroundAuditCart,
  recordForegroundAuditNetwork,
  recordForegroundAuditQuery,
  recordForegroundAuditRender,
  recordForegroundAuditStoreUpdate,
  recordForegroundInteractionsComplete,
  recordForegroundJsResponsivenessStart,
  recordForegroundTransition,
  resetForegroundAuditSession,
} from '@/lib/foreground-audit/state';
