import { isDevAuditFlagEnabled } from '@/lib/dev-audit-flag';

/** Dev-only — set `EXPO_PUBLIC_JS_FREEZE_AUDIT=1` to enable. Filter with `[JS_FREEZE]` / `[FREEZE_REPORT]`. */
export function isJsFreezeAuditEnabled(): boolean {
  return isDevAuditFlagEnabled(process.env.EXPO_PUBLIC_JS_FREEZE_AUDIT);
}
