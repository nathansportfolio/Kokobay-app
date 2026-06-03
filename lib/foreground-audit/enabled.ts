import { isDevAuditFlagEnabled } from '@/lib/dev-audit-flag';

/** Dev-only — set `EXPO_PUBLIC_FOREGROUND_AUDIT=1` to enable. Filter with `[FOREGROUND]`. */
export function isForegroundAuditEnabled(): boolean {
  return isDevAuditFlagEnabled(process.env.EXPO_PUBLIC_FOREGROUND_AUDIT);
}
