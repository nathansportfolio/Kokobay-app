import type { ExpoConfig } from 'expo/config';
import fs from 'fs';
import path from 'path';

/** Deep link / universal link values (keep in sync with `lib/deep-link-constants.ts`). */
const APP_URL_SCHEME = 'kokobay';
const LEGACY_APP_URL_SCHEME = 'kokobayapp';
const KOKOBAY_STORE_HOSTS = ['kokobay.co.uk', 'www.kokobay.co.uk'] as const;

/** Inlined — `@expo/config` does not transpile arbitrary `./lib/*.ts` imports from app.config.ts. */
function readFirebaseEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function isFirebaseAnalyticsEnabledFromEnv(): boolean {
  const value = readFirebaseEnv('EXPO_PUBLIC_FIREBASE_ANALYTICS_ENABLED');
  if (value === undefined) return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  return value === '1' || value === 'true' || value === 'yes';
}

function isFirebaseCrashlyticsEnabledFromEnv(): boolean {
  const value = readFirebaseEnv('EXPO_PUBLIC_FIREBASE_CRASHLYTICS_ENABLED');
  if (value === undefined) return true;
  if (value === '0' || value === 'false' || value === 'no') return false;
  return value === '1' || value === 'true' || value === 'yes';
}

/** Keep in sync with `constants/klaviyo.ts` — Klaviyo on unless env disables it. */
function isKlaviyoEnabledFromEnv(): boolean {
  const value = readFirebaseEnv('EXPO_PUBLIC_KLAVIYO_ENABLED');
  if (value === undefined) return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

/**
 * Dynamic Expo config — extends static `app.json` and adds push notification plugin
 * settings required for EAS / TestFlight / production (APNs + FCM via Expo).
 */
const appJson = require('./app.json') as { expo: ExpoConfig };

const expo = appJson.expo;

const APP_DISPLAY_NAME = 'Koko Bay';

const firebaseAnalyticsEnabled = isFirebaseAnalyticsEnabledFromEnv();
const firebaseCrashlyticsEnabled = isFirebaseCrashlyticsEnabledFromEnv();
const klaviyoEnabled = isKlaviyoEnabledFromEnv();
const iosGoogleServicesFile =
  readFirebaseEnv('EXPO_PUBLIC_FIREBASE_IOS_GOOGLE_SERVICES_FILE') ?? './GoogleService-Info.plist';
const androidGoogleServicesFile =
  readFirebaseEnv('EXPO_PUBLIC_FIREBASE_ANDROID_GOOGLE_SERVICES_FILE') ?? './google-services.json';

const hasIosGoogleServices = fs.existsSync(path.resolve(iosGoogleServicesFile));
const hasAndroidGoogleServices = fs.existsSync(path.resolve(androidGoogleServicesFile));
const useFirebaseNative =
  (firebaseAnalyticsEnabled || firebaseCrashlyticsEnabled) &&
  hasIosGoogleServices &&
  hasAndroidGoogleServices;

const firebaseStaticLinkModules = [
  'RNFBApp',
  ...(firebaseAnalyticsEnabled ? (['RNFBAnalytics'] as const) : []),
  ...(firebaseCrashlyticsEnabled ? (['RNFBCrashlytics'] as const) : []),
];

const basePlugins = [...(expo.plugins ?? [])];

const firebasePlugins: NonNullable<ExpoConfig['plugins']> = useFirebaseNative
  ? [
      '@react-native-firebase/app',
      ...(firebaseCrashlyticsEnabled ? (['@react-native-firebase/crashlytics'] as const) : []),
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            forceStaticLinking: firebaseStaticLinkModules,
          },
        },
      ],
    ]
  : [];

/** Analytics + profiles only — Expo push and Koko Bay `/api/push/*` stay unchanged. */
const klaviyoPlugins: NonNullable<ExpoConfig['plugins']> = klaviyoEnabled
  ? [
      [
        'klaviyo-expo-plugin',
        {
          android: {
            logLevel: 2,
            openTracking: false,
            geofencingEnabled: false,
            formsEnabled: true,
          },
          ios: {
            badgeAutoclearing: false,
            includeNotificationServiceExtension: false,
            formsEnabled: true,
            geofencingEnabled: false,
          },
        },
      ],
    ]
  : [];

const universalLinkHosts = [...KOKOBAY_STORE_HOSTS];

const androidIntentFilters = universalLinkHosts.map((host) => ({
  action: 'VIEW' as const,
  autoVerify: true,
  data: [
    {
      scheme: 'https',
      host,
      pathPrefix: '/',
    },
  ],
  category: ['BROWSABLE', 'DEFAULT'],
}));

const config: ExpoConfig = {
  ...expo,
  name: APP_DISPLAY_NAME,
  scheme: [APP_URL_SCHEME, LEGACY_APP_URL_SCHEME],
  ios: {
    ...expo.ios,
    ...(hasIosGoogleServices ? { googleServicesFile: iosGoogleServicesFile } : {}),
    associatedDomains: universalLinkHosts.map((host) => `applinks:${host}`),
    infoPlist: {
      ...expo.ios?.infoPlist,
      CFBundleDisplayName: APP_DISPLAY_NAME,
      CFBundleName: APP_DISPLAY_NAME,
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    ...expo.android,
    ...(hasAndroidGoogleServices ? { googleServicesFile: androidGoogleServicesFile } : {}),
    blockedPermissions: [
      ...(expo.android?.blockedPermissions ?? []),
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
    intentFilters: [...(expo.android?.intentFilters ?? []), ...androidIntentFilters],
  },
  plugins: [...basePlugins, ...firebasePlugins, ...klaviyoPlugins, ['expo-notifications', {
    icon: './assets/images/icon.png',
    color: '#8E6E66',
    defaultChannel: 'default',
    enableBackgroundRemoteNotifications: true,
  }]],
};

export default config;
