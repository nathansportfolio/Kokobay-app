/** Dev diagnostics — opt-in via `EXPO_PUBLIC_*=1` or `true` (off by default for faster daily dev). */
export function isDevAuditFlagEnabled(value: string | undefined): boolean {
  if (!__DEV__) return false;
  const normalized = value?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true';
}
