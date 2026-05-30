import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { isExpoDeviceNativeModuleAvailable, isPhysicalDevice } from '@/lib/expo-device-safe';
import { getExpoNotifications, isExpoGoClient, isExpoNotificationsNativeModuleAvailable } from '@/lib/expo-notifications-safe';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, View } from 'react-native';

import { AccountAuthBackButton } from '@/components/account/account-auth-back-button';
import { MarketCurrencySection } from '@/components/settings/market-currency-section';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getPushDeviceName, getPushPlatform, registerPushNotifications } from '@/lib/pushNotifications';
import { useAuthStore } from '@/store';
import { showToast } from '@/store/toast';

type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unknown';

function notificationsEnabled(state: PermissionState): boolean {
  return state === 'granted';
}

function formatNotificationsStatus(state: PermissionState): string {
  if (state === 'granted') return 'On';
  if (state === 'denied') return 'Off';
  if (state === 'undetermined') return 'Off';
  return 'Unknown';
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-8 border border-line bg-surface px-4 py-5">
      <Text variant="label" className="mb-4 text-mist">
        {title}
      </Text>
      {children}
    </View>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 flex-row items-start justify-between gap-4 last:mb-0">
      <Text variant="body" className="shrink-0 text-mist">
        {label}
      </Text>
      <Text variant="body" className="flex-1 text-right text-ink">
        {value}
      </Text>
    </View>
  );
}

type AccountAppSettingsProps = {
  canGoBack?: boolean;
  onBack?: () => void;
  onRegisterRefresh?: (refresh: (() => Promise<void>) | null) => void;
};

export function AccountAppSettings({ canGoBack = false, onBack, onRegisterRefresh }: AccountAppSettingsProps) {
  const user = useAuthStore((s) => s.user);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [pushBusy, setPushBusy] = useState(false);

  const refreshPermission = useCallback(async () => {
    if (isExpoGoClient()) {
      setPermission('unknown');
      return;
    }

    const Notifications = getExpoNotifications();
    if (!Notifications) {
      setPermission('unknown');
      return;
    }
    try {
      const result = await Notifications.getPermissionsAsync();
      const iosAllowsAlert = result.ios?.allowsAlert;
      const granted =
        result.status === 'granted' &&
        (Platform.OS !== 'ios' || iosAllowsAlert !== false);

      if (granted) setPermission('granted');
      else if (result.status === 'denied') setPermission('denied');
      else if (result.status === 'undetermined') setPermission('undetermined');
      else setPermission('unknown');
    } catch {
      setPermission('unknown');
    }
  }, []);

  useEffect(() => {
    onRegisterRefresh?.(refreshPermission);
    return () => onRegisterRefresh?.(null);
  }, [onRegisterRefresh, refreshPermission]);

  useFocusEffect(
    useCallback(() => {
      void refreshPermission();
    }, [refreshPermission]),
  );

  const notificationsOn = notificationsEnabled(permission);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Constants.nativeBuildVersion ??
    '—';

  const onEnablePush = async () => {
    setPushBusy(true);
    const result = await registerPushNotifications(user?.email);
    setPushBusy(false);
    await refreshPermission();
    if (result.ok) {
      showToast(
        result.skipped
          ? { variant: 'info', title: 'Push notifications already enabled' }
          : { variant: 'success', title: 'Push notifications enabled' },
      );
    } else {
      showToast({ variant: 'error', title: result.message });
    }
  };

  const onOpenSystemSettings = () => {
    void Linking.openSettings();
  };

  return (
    <>
      {canGoBack && onBack ?
        <AccountAuthBackButton label="Account" onPress={onBack} />
      : null}

      <Text variant="caption" className="mb-8 text-mist">
        Shopping preferences, notifications, and app information for this device.
      </Text>

      <SettingsSection title="Currency">
        <MarketCurrencySection />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsRow
          label="Notifications"
          value={formatNotificationsStatus(permission)}
        />
        <SettingsRow
          label="Device"
          value={isPhysicalDevice() ? getPushDeviceName() : 'Simulator'}
        />
        <SettingsRow label="Platform" value={getPushPlatform()} />
        <View className="mt-5 gap-3">
          {notificationsOn ?
            <>
              <Text variant="caption" className="text-center text-mist">
                Order updates and alerts are enabled on this device. To turn them off, use
                system settings.
              </Text>
              <Button
                title="Manage in system settings"
                variant="secondary"
                onPress={onOpenSystemSettings}
              />
            </>
          : permission === 'denied' ?
            <>
              <Text variant="caption" className="text-center text-mist">
                Notifications are turned off for Koko Bay. Enable them in system settings.
              </Text>
              <Button
                title="Open system settings"
                variant="primary"
                onPress={onOpenSystemSettings}
              />
            </>
          : <>
              <Button
                title={pushBusy ? 'Updating…' : 'Turn on notifications'}
                variant="primary"
                loading={pushBusy}
                disabled={pushBusy || !isPhysicalDevice()}
                onPress={onEnablePush}
              />
              {!isPhysicalDevice() ?
                <Text variant="caption" className="text-center text-mist">
                  Push notifications require a physical device, not a simulator.
                </Text>
              : !user ?
                <Text variant="caption" className="text-center text-mist">
                  You can enable alerts without signing in. Sign in to link order updates to your
                  account.
                </Text>
              : null}
            </>
          }
          {!isExpoDeviceNativeModuleAvailable() || !isExpoNotificationsNativeModuleAvailable() ?
            <Text variant="caption" className="text-center text-mist">
              {isExpoGoClient() ?
                'Push notifications are not available in Expo Go. Use a development or TestFlight build.'
              : 'Rebuild the app (dev client or TestFlight) after adding push packages — this install is missing native modules.'}
            </Text>
          : null}
        </View>
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow label="App version" value={String(appVersion)} />
        <SettingsRow label="Build" value={String(buildNumber)} />
        <SettingsRow
          label="Environment"
          value={__DEV__ ? 'Development' : 'Production'}
        />
        {Platform.OS === 'web' ?
          <SettingsRow label="Platform" value="Web" />
        : null}
      </SettingsSection>
    </>
  );
}
