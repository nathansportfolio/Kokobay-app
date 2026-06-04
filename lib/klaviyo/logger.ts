export type KlaviyoLogKind =
  | 'identify'
  | 'event'
  | 'profile_update'
  | 'reset'
  | 'initialized'
  | 'push_token_set'
  | 'status'
  | 'skipped';

export function klaviyoLog(kind: KlaviyoLogKind, detail: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[KLAVIYO] ${kind}`, detail);
}
