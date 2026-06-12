export function readFirebaseEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/**
 * Firebase Analytics is on by default.
 * Set `EXPO_PUBLIC_FIREBASE_ANALYTICS_ENABLED=false` (or `0` / `no`) to disable.
 */
export function isFirebaseAnalyticsEnabledFromEnv(): boolean {
  const value = readFirebaseEnv('EXPO_PUBLIC_FIREBASE_ANALYTICS_ENABLED');
  if (value === undefined) return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  return value === '1' || value === 'true' || value === 'yes';
}

/** Runtime gate — always off in Metro/dev so no Analytics events or native debug logs fire. */
export function isFirebaseAnalyticsRuntimeEnabled(): boolean {
  if (__DEV__) return false;
  return isFirebaseAnalyticsEnabledFromEnv();
}

export function isFirebaseAnalyticsDebugFromEnv(): boolean {
  const value = readFirebaseEnv('EXPO_PUBLIC_FIREBASE_ANALYTICS_DEBUG');
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * Firebase Crashlytics is on by default.
 * Set `EXPO_PUBLIC_FIREBASE_CRASHLYTICS_ENABLED=false` (or `0` / `no`) to disable.
 */
export function isFirebaseCrashlyticsEnabledFromEnv(): boolean {
  const value = readFirebaseEnv('EXPO_PUBLIC_FIREBASE_CRASHLYTICS_ENABLED');
  if (value === undefined) return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  return value === '1' || value === 'true' || value === 'yes';
}

/** Runtime gate — always off in Metro/dev so no Crashlytics collection or logs fire. */
export function isFirebaseCrashlyticsRuntimeEnabled(): boolean {
  if (__DEV__) return false;
  return isFirebaseCrashlyticsEnabledFromEnv();
}
