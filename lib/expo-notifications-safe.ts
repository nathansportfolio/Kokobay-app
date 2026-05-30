import Constants from 'expo-constants';

type ExpoNotificationsModule = typeof import('expo-notifications');

let notificationsModule: ExpoNotificationsModule | null | undefined;

/** True when running inside the Expo Go store client (no custom native push modules). */
export function isExpoGoClient(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

/** Lazy-load `expo-notifications` so older dev clients without the native module still boot. */
export function getExpoNotifications(): ExpoNotificationsModule | null {
  if (isExpoGoClient()) {
    notificationsModule = null;
    return null;
  }

  if (notificationsModule !== undefined) {
    return notificationsModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require('expo-notifications') as ExpoNotificationsModule;
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

export function isExpoNotificationsNativeModuleAvailable(): boolean {
  return !isExpoGoClient() && getExpoNotifications() !== null;
}
