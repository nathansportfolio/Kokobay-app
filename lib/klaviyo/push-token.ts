import { Platform } from 'react-native';

import { isPhysicalDevice } from '@/lib/expo-device-safe';
import { getExpoNotifications, isExpoGoClient } from '@/lib/expo-notifications-safe';
import { getKlaviyoPublicApiKeyFromEnv, isKlaviyoEnabledFromEnv } from '@/lib/klaviyo-env';
import { isKlaviyoNativeModuleAvailable } from '@/lib/klaviyo-native-safe';
import { isFcmTokenUnavailableError } from '@/lib/klaviyo/push-token-unavailable';
import { klaviyoLog } from '@/lib/klaviyo/logger';
import { reportErrorToFirebaseCrashlytics } from '@/src/lib/firebase-crashlytics';

let lastRegisteredKlaviyoPushToken: string | null = null;

/** Set by `initializeKlaviyo()` after a successful SDK init — required before `setPushToken`. */
let klaviyoSdkReady = false;

/** Temporary production diagnostics — remove after Klaviyo push registration is verified. */
const KLAVIYO_PUSH_DIAG = '[KLAVIYO_PUSH_DIAG]' as const;

export function markKlaviyoSdkReadyForPush(): void {
  klaviyoSdkReady = true;
}

function maskPushToken(token: string): string {
  const t = token.trim();
  if (t.length <= 12) return '***';
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

function logKlaviyoPushDiag(step: string, detail: Record<string, unknown>): void {
  console.log(KLAVIYO_PUSH_DIAG, step, detail);
}

function reportKlaviyoPushDiagError(source: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logKlaviyoPushDiag('catch', {
    source,
    message,
    name: error instanceof Error ? error.name : undefined,
    fcmUnavailable: isFcmTokenUnavailableError(error),
  });

  if (isFcmTokenUnavailableError(error)) {
    klaviyoLog('skipped', {
      reason: 'FCM unavailable on this device (Google Play Services)',
      source,
      message,
    });
    return;
  }

  reportErrorToFirebaseCrashlytics({
    message: `Klaviyo push token sync failed: ${message}`,
    level: 'error',
    name: 'KlaviyoPushTokenSyncError',
    stack: error instanceof Error ? error.stack : undefined,
    context: { source },
  });
}

function isKlaviyoReadyForPush(): boolean {
  return isKlaviyoEnabledFromEnv() && Boolean(getKlaviyoPublicApiKeyFromEnv()?.trim());
}

function loadKlaviyoSdkForPush(): typeof import('klaviyo-react-native-sdk') | null {
  if (!isKlaviyoReadyForPush() || Platform.OS === 'web' || !isKlaviyoNativeModuleAvailable()) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('klaviyo-react-native-sdk') as typeof import('klaviyo-react-native-sdk');
  } catch {
    return null;
  }
}

/**
 * Registers the native APNs / FCM device token with Klaviyo (dual-channel alongside Expo push).
 * Does not call `getExpoPushTokenAsync` or `/api/push/register`.
 */
export async function syncKlaviyoPushToken(source: string): Promise<void> {
  logKlaviyoPushDiag('enter', { source, platform: Platform.OS });

  if (!isKlaviyoReadyForPush() || !klaviyoSdkReady) {
    return;
  }

  if (isExpoGoClient()) {
    klaviyoLog('skipped', { reason: 'Expo Go — no Klaviyo push token', source });
    return;
  }

  const sdk = loadKlaviyoSdkForPush();
  if (!sdk) {
    klaviyoLog('skipped', { reason: 'Klaviyo SDK unavailable', source });
    return;
  }

  if (!isPhysicalDevice()) {
    klaviyoLog('skipped', { reason: 'simulator — native push token unavailable', source });
    return;
  }

  const Notifications = getExpoNotifications();
  if (!Notifications) {
    klaviyoLog('skipped', { reason: 'expo-notifications unavailable', source });
    return;
  }

  const { status } = await Notifications.getPermissionsAsync();
  logKlaviyoPushDiag('notification_permission', { source, status });
  if (status !== 'granted') {
    klaviyoLog('skipped', { reason: 'notification permission not granted', source, status });
    return;
  }

  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const token = deviceToken.data?.trim();
    logKlaviyoPushDiag('getDevicePushTokenAsync_success', {
      source,
      tokenType: deviceToken.type,
      hasToken: Boolean(token),
      tokenMasked: token ? maskPushToken(token) : undefined,
    });
    if (!token) {
      klaviyoLog('skipped', { reason: 'empty native push token', source, tokenType: deviceToken.type });
      return;
    }

    const rebindProfile =
      source === 'identifyKlaviyoUser' || source === 'resetKlaviyoProfile';

    if (!rebindProfile && lastRegisteredKlaviyoPushToken === token) {
      klaviyoLog('skipped', {
        reason: 'native push token unchanged',
        source,
        tokenMasked: maskPushToken(token),
        tokenType: deviceToken.type,
      });
      return;
    }

    logKlaviyoPushDiag('before_setPushToken', {
      source,
      tokenType: deviceToken.type,
      tokenMasked: maskPushToken(token),
    });
    sdk.Klaviyo.setPushToken(token);
    lastRegisteredKlaviyoPushToken = token;
    logKlaviyoPushDiag('after_setPushToken', {
      source,
      tokenType: deviceToken.type,
      tokenMasked: maskPushToken(token),
    });

    klaviyoLog('push_token_set', {
      source,
      platform: Platform.OS,
      tokenType: deviceToken.type,
      tokenMasked: maskPushToken(token),
    });
  } catch (error) {
    reportKlaviyoPushDiagError(source, error);
    klaviyoLog('skipped', {
      reason: 'getDevicePushTokenAsync or setPushToken failed',
      source,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Fire-and-forget native push token sync (runs after init / identify). */
export function scheduleKlaviyoPushTokenSync(source: string): void {
  void syncKlaviyoPushToken(source);
}
