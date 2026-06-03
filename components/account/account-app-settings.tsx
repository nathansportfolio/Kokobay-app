import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { isExpoDeviceNativeModuleAvailable, isPhysicalDevice } from '@/lib/expo-device-safe';
import { getExpoNotifications, isExpoGoClient, isExpoNotificationsNativeModuleAvailable } from '@/lib/expo-notifications-safe';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Switch, View } from 'react-native';

import { AccountAuthBackButton } from '@/components/account/account-auth-back-button';
import { AccountLegalLinks } from '@/components/account/account-legal-links';
import { MarketCurrencySection } from '@/components/settings/market-currency-section';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import { openNotificationSettingsWithAlert } from '@/lib/open-notification-settings';
import { getPushDeviceName, getPushPlatform, registerPushNotifications } from '@/lib/pushNotifications';
import {
  fetchCustomerMarketingConsent,
  updateCustomerMarketingConsent,
} from '@/services/kokobay-web/marketing-consent';
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

function formatMarketingStatus(
  loading: boolean,
  subscribed: boolean | null,
  rateLimited: boolean,
  profileFallback?: boolean | null,
): string {
  if (loading) return 'Loading…';
  if (subscribed === true) return 'Subscribed';
  if (subscribed === false) return 'Not subscribed';
  if (rateLimited) return 'Try again in a moment';
  if (profileFallback === true) return 'Subscribed (syncing…)';
  if (profileFallback === false) return 'Not subscribed (syncing…)';
  return 'Unknown';
}

function profileMarketingFallback(user: { acceptsMarketing?: boolean | null } | null): boolean | null {
  if (!user || user.acceptsMarketing == null) return null;
  return user.acceptsMarketing === true;
}

function SettingsToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const handleValueChange = (next: boolean) => {
    if (disabled) return;
    onValueChange(next);
  };

  return (
    <View className="flex-row items-center justify-between gap-4 py-1">
      <View className="min-w-0 flex-1">
        <Text variant="body" className="text-ink">
          {label}
        </Text>
        {description ?
          <Text variant="caption" className="mt-1 text-mist">
            {description}
          </Text>
        : null}
      </View>
      <Switch
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        trackColor={{ false: palette.line, true: palette.ink }}
        thumbColor={palette.canvas}
        ios_backgroundColor={palette.line}
      />
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
  const accessToken = useAuthStore((s) => s.accessToken);
  const patchUser = useAuthStore((s) => s.patchUser);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [pushBusy, setPushBusy] = useState(false);
  const [emailSubscribed, setEmailSubscribed] = useState<boolean | null>(() =>
    profileMarketingFallback(user),
  );
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingBusy, setMarketingBusy] = useState(false);
  const [marketingRateLimited, setMarketingRateLimited] = useState(false);
  const marketingRefreshInFlightRef = useRef(false);

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
      else if (
        result.status === 'denied' ||
        (result.status === 'granted' && iosAllowsAlert === false)
      ) {
        setPermission('denied');
      } else if (result.status === 'undetermined') setPermission('undetermined');
      else setPermission('unknown');
    } catch {
      setPermission('unknown');
    }
  }, []);

  const refreshMarketing = useCallback(async () => {
    const signedInUser = useAuthStore.getState().user;
    if (!signedInUser) {
      setEmailSubscribed(null);
      setMarketingRateLimited(false);
      return;
    }
    if (marketingRefreshInFlightRef.current) return;
    marketingRefreshInFlightRef.current = true;
    setMarketingLoading(true);
    try {
      const result = await fetchCustomerMarketingConsent(accessToken);
      if (result.ok) {
        setMarketingRateLimited(false);
        setEmailSubscribed(result.subscribed);
        const current = useAuthStore.getState().user;
        if (current && current.acceptsMarketing !== result.subscribed) {
          patchUser({ acceptsMarketing: result.subscribed });
        }
        return;
      }

      if (result.code === 'rate_limited') {
        setMarketingRateLimited(true);
        setEmailSubscribed((prev) => {
          if (prev !== null) return prev;
          return profileMarketingFallback(signedInUser);
        });
      }
    } finally {
      marketingRefreshInFlightRef.current = false;
      setMarketingLoading(false);
    }
  }, [accessToken, patchUser]);

  const refreshPreferences = useCallback(async () => {
    await refreshPermission();
    await refreshMarketing();
  }, [refreshMarketing, refreshPermission]);

  const refreshPreferencesRef = useRef(refreshPreferences);
  refreshPreferencesRef.current = refreshPreferences;

  useEffect(() => {
    onRegisterRefresh?.(refreshPreferences);
    return () => onRegisterRefresh?.(null);
  }, [onRegisterRefresh, refreshPreferences]);

  useFocusEffect(
    useCallback(() => {
      void refreshPermission();
    }, [refreshPermission]),
  );

  useEffect(() => {
    if (!user?.id) {
      setEmailSubscribed(null);
      setMarketingRateLimited(false);
      return;
    }
    void refreshMarketing();
  }, [refreshMarketing, user?.id]);

  const marketingSwitchValue = emailSubscribed ?? profileMarketingFallback(user) === true;
  const marketingToggleDisabled = marketingBusy;

  const onToggleMarketing = useCallback(
    async (next: boolean) => {
      if (marketingBusy) return;
      if (!user) return;

      const previous = emailSubscribed ?? profileMarketingFallback(user) === true;
      setEmailSubscribed(next);
      setMarketingBusy(true);
      setMarketingRateLimited(false);

      try {
        const result = await updateCustomerMarketingConsent(next, accessToken);

        if (!result.ok) {
          setEmailSubscribed(previous);
          if (result.code === 'rate_limited') setMarketingRateLimited(true);
          showToast({ variant: 'error', title: result.error });
          return;
        }
        setEmailSubscribed(result.subscribed);
        const current = useAuthStore.getState().user;
        if (current && current.acceptsMarketing !== result.subscribed) {
          patchUser({ acceptsMarketing: result.subscribed });
        }
        showToast({
          variant: 'success',
          title: result.subscribed ? 'Marketing emails on' : 'Marketing emails off',
        });
      } catch {
        setEmailSubscribed(previous);
        showToast({
          variant: 'error',
          title: 'Could not update marketing preferences. Try again.',
        });
      } finally {
        setMarketingBusy(false);
      }
    },
    [accessToken, emailSubscribed, marketingBusy, patchUser, user],
  );

  const notificationsOn = notificationsEnabled(permission);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    Constants.nativeBuildVersion ??
    '—';

  const onOpenNotificationSettings = async () => {
    await openNotificationSettingsWithAlert();
  };

  /** First launch: OS permission sheet. After deny or if already asked: Koko Bay notification settings. */
  const onTurnOnNotifications = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const canRequestInApp =
        permission === 'undetermined' &&
        isPhysicalDevice() &&
        isExpoNotificationsNativeModuleAvailable();

      if (canRequestInApp) {
        const Notifications = getExpoNotifications();
        if (Notifications) {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
          await refreshPermission();
          if (status === 'granted') {
            const result = await registerPushNotifications(user?.email, 'account_settings_enable');
            if (result.ok) {
              showToast(
                result.skipped
                  ? { variant: 'info', title: 'Push notifications already enabled' }
                  : { variant: 'success', title: 'Push notifications enabled' },
              );
              return;
            }
            showToast({ variant: 'error', title: result.message });
          }
        }
      }

      await onOpenNotificationSettings();
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <>
      {canGoBack && onBack ?
        <AccountAuthBackButton label="Account" onPress={onBack} />
      : null}

      <Text variant="caption" className="mb-8 text-mist">
        Shopping preferences, alerts, and app information for this device.
      </Text>

      <SettingsSection title="Currency">
        <MarketCurrencySection />
      </SettingsSection>

      <SettingsSection title="Preferences">
        <Text variant="label" className="mb-3 text-mist">
          Push notifications
        </Text>
        <SettingsRow
          label="Status"
          value={formatNotificationsStatus(permission)}
        />
        <SettingsRow
          label="Device"
          value={isPhysicalDevice() ? getPushDeviceName() : 'Simulator'}
        />
        <SettingsRow label="Platform" value={getPushPlatform()} />
        <View className="mt-4 gap-3">
          {notificationsOn ?
            <>
              <Text variant="caption" className="text-center text-mist">
                Order updates and alerts are enabled on this device. To change them, open Koko Bay
                notification settings.
              </Text>
              <Button
                title="Manage notification settings"
                variant="secondary"
                onPress={onOpenNotificationSettings}
              />
            </>
          : <>
              <Text variant="caption" className="text-center text-mist">
                {permission === 'denied' || permission === 'unknown' ?
                  'Notifications are turned off for Koko Bay. Turn them on in Koko Bay notification settings.'
                : 'Allow notifications for order updates and alerts. You will be taken to Koko Bay notification settings.'}
              </Text>
              <Button
                title={pushBusy ? 'Opening…' : 'Turn Notifications On'}
                variant="primary"
                loading={pushBusy}
                disabled={pushBusy}
                onPress={onTurnOnNotifications}
              />
              {!isPhysicalDevice() ?
                <Text variant="caption" className="text-center text-mist">
                  On a simulator, use Settings to preview the flow. Push delivery requires a
                  physical device.
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

        <View className="mt-8 border-t border-line/60 pt-6">
          <Text variant="label" className="mb-3 text-mist">
            Marketing emails
          </Text>
          {user ?
            <>
              <SettingsRow
                label="Status"
                value={formatMarketingStatus(
                  marketingLoading,
                  emailSubscribed,
                  marketingRateLimited,
                  user.acceptsMarketing,
                )}
              />
              <SettingsToggleRow
                label="Email updates"
                description="News, offers, and Koko Bay updates by email."
                value={marketingSwitchValue}
                onValueChange={onToggleMarketing}
                disabled={marketingToggleDisabled}
              />
              {marketingRateLimited ?
                <Text variant="caption" className="mt-2 text-center text-mist">
                  Status could not be refreshed. You can still change your preference below.
                </Text>
              : null}
            </>
          : <Text variant="body" className="text-mist">
              Sign in to view and change your email marketing preferences.
            </Text>
          }
        </View>
      </SettingsSection>

      <View className="mb-8">
        <AccountLegalLinks />
      </View>

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
