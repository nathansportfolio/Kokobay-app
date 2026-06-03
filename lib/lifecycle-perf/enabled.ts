import { isDevAuditFlagEnabled } from '@/lib/dev-audit-flag';

/** Dev-only — set `EXPO_PUBLIC_LIFECYCLE_PERF=1` to enable `[lifecycle]` dashboards and store instrumentation. */
export function isLifecyclePerfEnabled(): boolean {
  return isDevAuditFlagEnabled(process.env.EXPO_PUBLIC_LIFECYCLE_PERF);
}
