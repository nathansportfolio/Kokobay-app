import { NativeModules } from 'react-native';

import { isExpoGoClient } from '@/lib/expo-notifications-safe';

/** True when the dev/production binary includes the Klaviyo native module (post-prebuild). */
export function isKlaviyoNativeModuleAvailable(): boolean {
  if (isExpoGoClient()) return false;
  return Boolean(NativeModules.KlaviyoReactNativeSdk);
}
