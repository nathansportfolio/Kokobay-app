/** Android FCM / Google Play Services errors that are expected on some devices — not app bugs. */
const FCM_UNAVAILABLE_PATTERNS = [
  'MISSING_INSTANCEID_SERVICE',
  'SERVICE_NOT_AVAILABLE',
  'Google Play services out of date',
  'Google Play services missing',
  'API: InstanceID is not available',
  'Firebase Installations Service is unavailable',
  'Failed to retrieve FCM token',
  'FIS_AUTH_ERROR',
] as const;

export function isFcmTokenUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.trim();
  if (!normalized) return false;
  return FCM_UNAVAILABLE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export type KlaviyoPushTokenSkipReason =
  | 'fcm_unavailable'
  | 'simulator'
  | 'permission_denied'
  | 'sdk_unavailable';
