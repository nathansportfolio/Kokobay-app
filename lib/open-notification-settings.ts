import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';

const APP_DISPLAY_NAME = 'Koko Bay';

/** Android 8+ — per-app notification settings (not generic device settings). */
const ANDROID_APP_NOTIFICATION_SETTINGS = 'android.settings.APP_NOTIFICATION_SETTINGS';
const ANDROID_EXTRA_APP_PACKAGE = 'android.provider.extra.APP_PACKAGE';

export type OpenNotificationSettingsMethod =
  | 'ios_app_settings'
  | 'android_notification_settings'
  | 'android_app_settings_fallback';

export type OpenNotificationSettingsResult =
  | { ok: true; method: OpenNotificationSettingsMethod }
  | { ok: false; error: string };

function getAndroidPackageName(): string | null {
  const fromConfig = Constants.expoConfig?.android?.package;
  if (typeof fromConfig === 'string' && fromConfig.length > 0) {
    return fromConfig;
  }
  const manifest = (Constants as { manifest?: { android?: { package?: string } } }).manifest;
  const fromManifest = manifest?.android?.package;
  if (typeof fromManifest === 'string' && fromManifest.length > 0) {
    return fromManifest;
  }
  return null;
}

/**
 * Opens the OS screen where the user can enable notifications for Koko Bay.
 *
 * - **iOS:** App-specific Settings page (Notifications toggle for this app).
 * - **Android:** App notification settings when supported; otherwise the app info page.
 */
export async function openNotificationSettings(): Promise<OpenNotificationSettingsResult> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openSettings();
      return { ok: true, method: 'ios_app_settings' };
    }

    if (Platform.OS === 'android') {
      const packageName = getAndroidPackageName();
      if (packageName) {
        try {
          await Linking.sendIntent(ANDROID_APP_NOTIFICATION_SETTINGS, [
            { key: ANDROID_EXTRA_APP_PACKAGE, value: packageName },
          ]);
          return { ok: true, method: 'android_notification_settings' };
        } catch {
          // Older devices / OEMs — fall back to app details in Settings.
        }
      }

      await Linking.openSettings();
      return { ok: true, method: 'android_app_settings_fallback' };
    }

    return { ok: false, error: 'Notification settings are not available on this platform.' };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not open notification settings.';
    return { ok: false, error: message };
  }
}

/** User-facing alert when `openNotificationSettings()` cannot open a settings screen. */
export function showNotificationSettingsUnavailableAlert(): void {
  Alert.alert(
    'Could not open settings',
    `Open your device Settings, find ${APP_DISPLAY_NAME}, and turn on notifications.`,
    [{ text: 'OK' }],
  );
}

/**
 * Opens Koko Bay notification settings; shows an alert if the OS screen cannot be opened.
 * @returns Whether a settings screen was opened successfully.
 */
export async function openNotificationSettingsWithAlert(): Promise<boolean> {
  const result = await openNotificationSettings();
  if (!result.ok) {
    showNotificationSettingsUnavailableAlert();
    return false;
  }
  return true;
}
