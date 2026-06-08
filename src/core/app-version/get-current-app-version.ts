import Constants from 'expo-constants';

/** Current semver from Expo config (falls back to native runtime version). */
export function getCurrentAppVersion(): string {
  const version =
    Constants.expoConfig?.version ??
    Constants.nativeApplicationVersion ??
    Constants.nativeAppVersion;
  return typeof version === 'string' && version.trim() ? version.trim() : '0.0.0';
}
