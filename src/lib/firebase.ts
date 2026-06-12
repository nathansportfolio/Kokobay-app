import { Platform } from 'react-native';

import {
  isFirebaseAnalyticsDebugFromEnv,
  isFirebaseAnalyticsRuntimeEnabled,
  readFirebaseEnv,
} from '@/lib/firebase-env';
import { isFirebaseNativeModuleAvailable } from '@/lib/firebase-native-safe';
import type { FirebaseAnalyticsConfig } from '@/src/types/analytics';

/** Runtime Firebase / Analytics flags (from `EXPO_PUBLIC_*` env vars). */
export function getFirebaseAnalyticsConfig(): FirebaseAnalyticsConfig {
  return {
    enabled: isFirebaseAnalyticsRuntimeEnabled(),
    debug: !__DEV__ && isFirebaseAnalyticsDebugFromEnv(),
    iosGoogleServicesFile:
      readFirebaseEnv('EXPO_PUBLIC_FIREBASE_IOS_GOOGLE_SERVICES_FILE') ??
      './GoogleService-Info.plist',
    androidGoogleServicesFile:
      readFirebaseEnv('EXPO_PUBLIC_FIREBASE_ANDROID_GOOGLE_SERVICES_FILE') ??
      './google-services.json',
    apiKey: readFirebaseEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
    projectId: readFirebaseEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    appId: readFirebaseEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
    measurementId: readFirebaseEnv('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID'),
  };
}

export function isFirebaseAnalyticsEnabled(): boolean {
  return getFirebaseAnalyticsConfig().enabled;
}

type FirebaseAnalyticsModule = typeof import('@react-native-firebase/analytics').default;

let analyticsInstance: ReturnType<FirebaseAnalyticsModule> | null | undefined;
let initAttempted = false;

function loadAnalyticsModule(): ReturnType<FirebaseAnalyticsModule> | null {
  if (analyticsInstance !== undefined) {
    return analyticsInstance;
  }

  if (!isFirebaseAnalyticsEnabled()) {
    analyticsInstance = null;
    return null;
  }

  if (Platform.OS === 'web' || !isFirebaseNativeModuleAvailable()) {
    analyticsInstance = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analytics = require('@react-native-firebase/analytics').default as FirebaseAnalyticsModule;
    analyticsInstance = analytics();
    return analyticsInstance;
  } catch {
    analyticsInstance = null;
    return null;
  }
}

/** Lazy, safe access to the native Analytics module (null in Expo Go / web / when disabled). */
export function getFirebaseAnalytics() {
  return loadAnalyticsModule();
}

/**
 * One-time Analytics setup. Native Firebase is configured via google-services files
 * referenced in `app.config.ts`; env vars gate collection and debug logging.
 */
export async function initializeFirebaseAnalytics(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;

  if (!isFirebaseAnalyticsRuntimeEnabled()) return;

  const config = getFirebaseAnalyticsConfig();
  const analytics = getFirebaseAnalytics();
  if (!analytics) return;

  await analytics.setAnalyticsCollectionEnabled(config.enabled);
}
