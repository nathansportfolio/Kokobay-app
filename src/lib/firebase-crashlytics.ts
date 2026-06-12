import { Platform } from 'react-native';

import { isFirebaseCrashlyticsRuntimeEnabled } from '@/lib/firebase-env';
import { isFirebaseNativeModuleAvailable } from '@/lib/firebase-native-safe';

export type CrashlyticsReportInput = {
  message: string;
  level?: 'error' | 'warn' | 'info';
  fatal?: boolean;
  name?: string;
  stack?: string;
  screen?: string;
  context?: Record<string, unknown>;
};

export type FirebaseCrashlyticsConfig = {
  enabled: boolean;
};

export function getFirebaseCrashlyticsConfig(): FirebaseCrashlyticsConfig {
  return {
    enabled: isFirebaseCrashlyticsRuntimeEnabled(),
  };
}

type FirebaseCrashlyticsModule = typeof import('@react-native-firebase/crashlytics').default;

let crashlyticsInstance: ReturnType<FirebaseCrashlyticsModule> | null | undefined;
let initAttempted = false;

function loadCrashlyticsModule(): ReturnType<FirebaseCrashlyticsModule> | null {
  if (crashlyticsInstance !== undefined) {
    return crashlyticsInstance;
  }

  if (!isFirebaseCrashlyticsRuntimeEnabled()) {
    crashlyticsInstance = null;
    return null;
  }

  if (Platform.OS === 'web' || !isFirebaseNativeModuleAvailable()) {
    crashlyticsInstance = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crashlytics = require('@react-native-firebase/crashlytics')
      .default as FirebaseCrashlyticsModule;
    crashlyticsInstance = crashlytics();
    return crashlyticsInstance;
  } catch {
    crashlyticsInstance = null;
    return null;
  }
}

/** Lazy access to the native Crashlytics module (null in Expo Go / web / when disabled). */
export function getFirebaseCrashlytics() {
  return loadCrashlyticsModule();
}

/**
 * One-time Crashlytics setup. Native Firebase is configured via google-services files
 * and Expo config plugins; this gates collection at runtime.
 */
export async function initializeFirebaseCrashlytics(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;

  if (!isFirebaseCrashlyticsRuntimeEnabled()) return;

  const crashlytics = getFirebaseCrashlytics();
  if (!crashlytics) return;

  const { enabled } = getFirebaseCrashlyticsConfig();
  await crashlytics.setCrashlyticsCollectionEnabled(enabled);
}

/** Associates Crashlytics reports with a signed-in user (pass null to clear). */
export async function setFirebaseCrashlyticsUserId(userId: string | null | undefined): Promise<void> {
  const crashlytics = getFirebaseCrashlytics();
  if (!crashlytics) return;

  const id = userId?.trim();
  await crashlytics.setUserId(id || '');
}

function buildErrorFromReport(input: CrashlyticsReportInput): Error {
  const error = new Error(input.message);
  if (input.name) error.name = input.name.slice(0, 120);
  if (input.stack) error.stack = input.stack.slice(0, 8000);
  return error;
}

function setReportAttributes(
  crashlytics: ReturnType<FirebaseCrashlyticsModule>,
  input: CrashlyticsReportInput,
): void {
  if (input.fatal) crashlytics.setAttribute('fatal', 'true');
  if (input.screen) crashlytics.setAttribute('screen', input.screen.slice(0, 240));
  if (input.level) crashlytics.setAttribute('level', input.level);
  const source = input.context?.source;
  if (typeof source === 'string') {
    crashlytics.setAttribute('source', source.slice(0, 240));
  }
}

/**
 * Forwards app errors to Firebase Crashlytics (non-fatal). Warnings are logged only.
 * Called from `reportAppError` alongside the Koko Bay API pipeline.
 */
export function reportErrorToFirebaseCrashlytics(input: CrashlyticsReportInput): void {
  if (!getFirebaseCrashlyticsConfig().enabled) return;

  const crashlytics = getFirebaseCrashlytics();
  if (!crashlytics) return;

  void (async () => {
    try {
      await initializeFirebaseCrashlytics();

      if (input.level === 'warn') {
        crashlytics.log(`[warn] ${input.message.slice(0, 1000)}`);
        return;
      }

      setReportAttributes(crashlytics, input);
      crashlytics.recordError(buildErrorFromReport(input));
    } catch {
      /* never break error reporting */
    }
  })();
}
