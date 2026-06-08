import { useFocusEffect } from 'expo-router';
import { isExpoDeviceNativeModuleAvailable, isPhysicalDevice } from '@/lib/expo-device-safe';
import { getExpoNotifications, isExpoGoClient, isExpoNotificationsNativeModuleAvailable } from '@/lib/expo-notifications-safe';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Switch, View } from 'react-native';

import { AccountCardDivider } from '@/components/account/account-layout';
import { AccountSettingsRow } from '@/components/account/account-settings-row';
import { MarketCurrencySection } from '@/components/settings/market-currency-section';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import { openNotificationSettingsWithAlert } from '@/lib/open-notification-settings';
import { registerPushNotifications } from '@/lib/pushNotifications';
import {
  fetchCustomerMarketingConsent,
  updateCustomerMarketingConsent,
} from '@/services/kokobay-web/marketing-consent';
import { getAuthAccessToken } from '@/src/core/auth/token';
import { useAuth } from '@/hooks/use-auth';
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

function formatMarketingStatus(
  loading: boolean,
  subscribed: boolean | null,
  rateLimited: boolean,
  profileFallback?: boolean | null,
): string {
  if (loading) return 'Loading…';
  if (subscribed === true) return 'On';
  if (subscribed === false) return 'Off';
  if (rateLimited) return 'Sync paused';
  if (profileFallback === true) return 'On (syncing)';
  if (profileFallback === false) return 'Off (syncing)';
  return 'Unknown';
}

function profileMarketingFallback(user: { acceptsMarketing?: boolean | null } | null): boolean | null {
  if (!user || user.acceptsMarketing == null) return null;
  return user.acceptsMarketing === true;
}

type AccountPreferencesPanelProps = {
  onRegisterRefresh?: (refresh: (() => Promise<void>) | null) => void;
};

export function AccountPreferencesPanel({ onRegisterRefresh }: AccountPreferencesPanelProps) {
  const { user } = useAuth();
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
      const accessToken = getAuthAccessToken();
      if (!accessToken) return;
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
  }, [patchUser]);

  const refreshPreferences = useCallback(async () => {
    await refreshPermission();
    await refreshMarketing();
  }, [refreshMarketing, refreshPermission]);

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
  const notificationsOn = notificationsEnabled(permission);

  const onToggleMarketing = useCallback(
    async (next: boolean) => {
      if (marketingBusy || !user) return;

      const previous = emailSubscribed ?? profileMarketingFallback(user) === true;
      setEmailSubscribed(next);
      setMarketingBusy(true);
      setMarketingRateLimited(false);

      try {
        const accessToken = getAuthAccessToken();
        if (!accessToken) {
          setEmailSubscribed(previous);
          showToast({ variant: 'error', title: 'Sign in to update marketing preferences.' });
          return;
        }
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
    [emailSubscribed, marketingBusy, patchUser, user],
  );

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
            const result = await registerPushNotifications(user?.email, 'account_preferences_enable');
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

      await openNotificationSettingsWithAlert();
    } finally {
      setPushBusy(false);
    }
  };

  const pushFootnote =
    !isExpoDeviceNativeModuleAvailable() || !isExpoNotificationsNativeModuleAvailable() ?
      isExpoGoClient() ?
        'Not available in Expo Go — use a development or store build.'
      : 'Rebuild the app after adding push packages.'
    : !isPhysicalDevice() ?
      'Push delivery requires a physical device.'
    : null;

  return (
    <View>
      <View className="py-3">
        <MarketCurrencySection compact />
      </View>

      <AccountCardDivider />

      <AccountSettingsRow
        label="Push notifications"
        value={formatNotificationsStatus(permission)}
        description={
          notificationsOn ?
            'Order updates and alerts on this device'
          : 'Tap to enable in device settings'
        }
        onPress={notificationsOn ? onOpenNotificationSettings : onTurnOnNotifications}
        disabled={pushBusy}
        showDivider
        trailing={
          notificationsOn ?
            undefined
          : <Button
              title={pushBusy ? '…' : 'Enable'}
              variant="secondary"
              className="min-h-[36px] px-4 py-2"
              loading={pushBusy}
              disabled={pushBusy}
              onPress={onTurnOnNotifications}
            />
        }
      />

      {user ?
        <>
          <AccountSettingsRow
            label="Marketing emails"
            description={formatMarketingStatus(
              marketingLoading,
              emailSubscribed,
              marketingRateLimited,
              user.acceptsMarketing,
            )}
            showDivider={false}
            trailing={
              <Switch
                value={marketingSwitchValue}
                onValueChange={onToggleMarketing}
                disabled={marketingBusy}
                trackColor={{ false: palette.line, true: palette.ink }}
                thumbColor={palette.canvas}
                ios_backgroundColor={palette.line}
              />
            }
          />
          {marketingRateLimited ?
            <Text variant="caption" className="px-4 pb-3 text-mist">
              Could not refresh status — you can still change your preference.
            </Text>
          : null}
        </>
      : <View className="px-4 py-3">
          <Text variant="caption" className="text-mist">
            Sign in to manage email marketing preferences.
          </Text>
        </View>
      }

      {pushFootnote ?
        <Text variant="caption" className="border-t border-line/35 px-4 py-3 text-mist">
          {pushFootnote}
        </Text>
      : null}
    </View>
  );
}

async function onOpenNotificationSettings() {
  await openNotificationSettingsWithAlert();
}
