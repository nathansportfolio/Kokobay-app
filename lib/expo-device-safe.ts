import { Platform } from 'react-native';

type ExpoDeviceModule = typeof import('expo-device');

let deviceModule: ExpoDeviceModule | null | undefined;

/**
 * Lazy-load `expo-device` so older dev clients (built before the package was added)
 * don't crash at import time with "Cannot find native module 'ExpoDevice'".
 * Rebuild the dev client / install a new EAS build for full native support.
 */
function getExpoDevice(): ExpoDeviceModule | null {
  if (deviceModule !== undefined) {
    return deviceModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    deviceModule = require('expo-device') as ExpoDeviceModule;
  } catch {
    deviceModule = null;
  }
  return deviceModule;
}

/** True on a physical phone/tablet. False on simulators and when the native module is missing. */
export function isPhysicalDevice(): boolean {
  const Device = getExpoDevice();
  if (!Device) {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }
  return Device.isDevice;
}

/** Label sent with push registration (`deviceName`). */
export function getDeviceLabel(): string {
  const Device = getExpoDevice();
  if (!Device) {
    return Platform.OS === 'ios' ? 'iOS device' : Platform.OS === 'android' ? 'Android device' : 'Device';
  }
  const parts = [Device.manufacturer, Device.modelName].filter(Boolean);
  if (parts.length) return parts.join(' ').trim();
  return Device.deviceName?.trim() || 'Unknown device';
}

/** Whether the native `expo-device` module is linked in this binary. */
export function isExpoDeviceNativeModuleAvailable(): boolean {
  return getExpoDevice() !== null;
}
