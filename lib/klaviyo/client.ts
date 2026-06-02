import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isExpoGoClient } from '@/lib/expo-notifications-safe';
import {
  getKlaviyoEnvDiagnostics,
  getKlaviyoPublicApiKeyFromEnv,
  isKlaviyoEnabledFromEnv,
} from '@/lib/klaviyo-env';
import { isKlaviyoNativeModuleAvailable } from '@/lib/klaviyo-native-safe';
import { klaviyoLog } from '@/lib/klaviyo/logger';
import type { AuthUser } from '@/types/auth';

type KlaviyoSdk = typeof import('klaviyo-react-native-sdk');
type KlaviyoEvent = import('klaviyo-react-native-sdk').Event;
type KlaviyoProfile = import('klaviyo-react-native-sdk').Profile;

let sdkModule: KlaviyoSdk | null | undefined;
let initAttempted = false;

function loadKlaviyoSdk(): KlaviyoSdk | null {
  if (sdkModule !== undefined) return sdkModule;
  if (!isKlaviyoEnabledFromEnv() || Platform.OS === 'web' || !isKlaviyoNativeModuleAvailable()) {
    sdkModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdkModule = require('klaviyo-react-native-sdk') as KlaviyoSdk;
    return sdkModule;
  } catch {
    sdkModule = null;
    return null;
  }
}

export function isKlaviyoConfigured(): boolean {
  return isKlaviyoEnabledFromEnv() && Boolean(getKlaviyoPublicApiKeyFromEnv()?.trim());
}

function logKlaviyoStartupStatus(extra?: Record<string, unknown>): void {
  if (!__DEV__) return;

  const env = getKlaviyoEnvDiagnostics();
  const nativeModule = isKlaviyoNativeModuleAvailable();
  const configured = isKlaviyoConfigured();

  klaviyoLog('status', {
    ...env,
    configured,
    nativeModule,
    platform: Platform.OS,
    expoGo: isExpoGoClient(),
    executionEnvironment: Constants.executionEnvironment,
    ...extra,
  });
}

/** Dev-only: call once when the app shell loads — always logs `[KLAVIYO] probe`. */
export function probeKlaviyoOnAppStart(): void {
  if (!__DEV__) return;

  const env = getKlaviyoEnvDiagnostics();
  console.log('[KLAVIYO] probe', {
    ...env,
    configured: isKlaviyoConfigured(),
    nativeModule: isKlaviyoNativeModuleAvailable(),
    platform: Platform.OS,
    expoGo: isExpoGoClient(),
    executionEnvironment: Constants.executionEnvironment,
    envEnabledRaw: process.env.EXPO_PUBLIC_KLAVIYO_ENABLED ?? null,
  });

  initializeKlaviyo();
}

/** Initialize Klaviyo SDK once per app launch (analytics + profiles only — no push token wiring). */
export function initializeKlaviyo(): void {
  if (initAttempted) return;
  initAttempted = true;

  if (!isKlaviyoEnabledFromEnv()) {
    logKlaviyoStartupStatus({ reason: 'EXPO_PUBLIC_KLAVIYO_ENABLED is not true' });
    return;
  }

  const apiKey = getKlaviyoPublicApiKeyFromEnv()?.trim();
  if (!apiKey) {
    logKlaviyoStartupStatus({
      reason: 'Missing EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY (6-char Site ID from Klaviyo settings)',
    });
    return;
  }

  if (!isKlaviyoNativeModuleAvailable()) {
    logKlaviyoStartupStatus({
      reason:
        isExpoGoClient()
          ? 'Expo Go has no Klaviyo native module — use a dev client build'
          : 'Klaviyo native module missing — rebuild after install (npx expo prebuild --clean && pnpm run ios:build)',
    });
    return;
  }

  const sdk = loadKlaviyoSdk();
  if (!sdk) {
    logKlaviyoStartupStatus({ reason: 'klaviyo-react-native-sdk failed to load' });
    return;
  }

  try {
    sdk.Klaviyo.initialize(apiKey);
    klaviyoLog('initialized', {
      platform: Platform.OS,
      apiKeySource: getKlaviyoEnvDiagnostics().apiKeySource,
      apiKeyMasked: getKlaviyoEnvDiagnostics().apiKeyMasked,
    });
  } catch (error) {
    klaviyoLog('skipped', {
      reason: 'Klaviyo.initialize threw',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export type KlaviyoIdentifyInput = Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>;

/** Identify a logged-in Shopify customer (email + external id). */
export function identifyKlaviyoUser(user: KlaviyoIdentifyInput): void {
  if (!isKlaviyoConfigured()) return;
  const sdk = loadKlaviyoSdk();
  if (!sdk) return;

  const email = user.email.trim();
  const externalId = user.id.trim();
  if (!email || !externalId) return;

  const profile: KlaviyoProfile = {
    email,
    externalId,
    firstName: user.firstName.trim() || undefined,
    lastName: user.lastName.trim() || undefined,
  };

  sdk.Klaviyo.setProfile(profile);
  klaviyoLog('identify', {
    email,
    customerId: externalId,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
  });
}

/** Sync profile fields after account updates (marketing consent, name patch, etc.). */
export function updateKlaviyoProfileProperties(input: Partial<KlaviyoIdentifyInput>): void {
  if (!isKlaviyoConfigured()) return;
  const sdk = loadKlaviyoSdk();
  if (!sdk) return;

  const profile: KlaviyoProfile = {
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.id?.trim() ? { externalId: input.id.trim() } : {}),
    ...(input.firstName?.trim() ? { firstName: input.firstName.trim() } : {}),
    ...(input.lastName?.trim() ? { lastName: input.lastName.trim() } : {}),
  };

  if (!profile.email && !profile.externalId && !profile.firstName && !profile.lastName) {
    return;
  }

  sdk.Klaviyo.setProfile(profile);
  klaviyoLog('profile_update', {
    email: profile.email ?? null,
    customerId: profile.externalId ?? null,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
  });
}

export function resetKlaviyoProfile(): void {
  if (!isKlaviyoConfigured()) return;
  const sdk = loadKlaviyoSdk();
  if (!sdk) return;

  sdk.Klaviyo.resetProfile();
  klaviyoLog('reset', {});
}

export function trackKlaviyoEvent(event: KlaviyoEvent): void {
  if (!isKlaviyoConfigured()) return;
  const sdk = loadKlaviyoSdk();
  if (!sdk) return;

  sdk.Klaviyo.createEvent(event);
  klaviyoLog('event', {
    name: event.name,
    value: event.value ?? null,
    properties: event.properties ?? null,
  });
}
