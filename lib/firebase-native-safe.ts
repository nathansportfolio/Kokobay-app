import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

/** True in the Expo Go store client (no @react-native-firebase native code). */
export function isExpoGoClient(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

/** True when the dev/production binary includes React Native Firebase (post-prebuild). */
export function isFirebaseNativeModuleAvailable(): boolean {
  if (isExpoGoClient()) return false;
  return Boolean(NativeModules.RNFBAppModule);
}
