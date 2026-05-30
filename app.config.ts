import type { ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config — extends static `app.json` and adds push notification plugin
 * settings required for EAS / TestFlight / production (APNs + FCM via Expo).
 */
const appJson = require('./app.json') as { expo: ExpoConfig };

const expo = appJson.expo;

const APP_DISPLAY_NAME = 'Koko Bay';

const config: ExpoConfig = {
  ...expo,
  name: APP_DISPLAY_NAME,
  ios: {
    ...expo.ios,
    infoPlist: {
      ...expo.ios?.infoPlist,
      CFBundleDisplayName: APP_DISPLAY_NAME,
      CFBundleName: APP_DISPLAY_NAME,
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    ...expo.android,
  },
  plugins: [
    ...(expo.plugins ?? []),
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
        color: '#8E6E66',
        defaultChannel: 'default',
        enableBackgroundRemoteNotifications: true,
      },
    ],
  ],
};

export default config;
