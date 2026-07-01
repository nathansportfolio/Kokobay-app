import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AccountCardDivider } from '@/components/account/account-layout';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import {
  cancelBackInStockSubscription,
  listBackInStockSubscriptions,
  type BackInStockSubscription,
} from '@/services/kokobay-web/back-in-stock';
import { getAuthAccessToken } from '@/src/core/auth/token';
import { showToast } from '@/store/toast';
import { cn } from '@/utils/cn';

type AccountBackInStockAlertsSectionProps = {
  userEmail: string;
  registerRefresh?: (refresh: (() => Promise<void>) | null) => void;
};

function subscriptionTitle(subscription: BackInStockSubscription): string {
  const title = subscription.productTitle?.trim();
  if (title) return title;
  return subscription.productHandle.replace(/-/g, ' ');
}

function subscriptionDetail(subscription: BackInStockSubscription): string {
  const variant = subscription.variantTitle?.trim();
  if (variant && variant !== 'Default Title') return variant;
  return 'Back in stock alert';
}

export function AccountBackInStockAlertsSection({
  userEmail,
  registerRefresh,
}: AccountBackInStockAlertsSectionProps) {
  const [subscriptions, setSubscriptions] = useState<BackInStockSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshAlerts = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (mountedRef.current && !hasLoadedRef.current) {
      setLoading(true);
    }
    if (mountedRef.current) setLoadError(null);

    try {
      const accessToken = getAuthAccessToken();
      if (!accessToken) {
        if (!mountedRef.current) return;
        setSubscriptions([]);
        setLoadError('Sign in to manage back-in-stock alerts.');
        return;
      }

      const result = await listBackInStockSubscriptions(userEmail, {
        sessionToken: accessToken,
      });

      if (!mountedRef.current) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }

      setSubscriptions(result.subscriptions);
      hasLoadedRef.current = true;
    } finally {
      refreshInFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    registerRefresh?.(refreshAlerts);
    return () => registerRefresh?.(null);
  }, [registerRefresh, refreshAlerts]);

  useEffect(() => {
    void refreshAlerts();
  }, [refreshAlerts]);

  const onRemove = useCallback(
    async (subscription: BackInStockSubscription) => {
      if (removingId) return;

      setRemovingId(subscription.subscriptionId);
      try {
        const accessToken = getAuthAccessToken();
        if (!accessToken) {
          showToast({ variant: 'error', title: 'Sign in to manage back-in-stock alerts.' });
          return;
        }

        const result = await cancelBackInStockSubscription({
          email: userEmail,
          subscriptionId: subscription.subscriptionId,
          variantId: subscription.variantId,
          sessionToken: accessToken,
        });

        if (!mountedRef.current) return;
        if (!result.ok) {
          showToast({ variant: 'error', title: result.error });
          return;
        }

        setSubscriptions((current) =>
          current.filter((row) => row.subscriptionId !== subscription.subscriptionId),
        );
        showToast({ variant: 'success', title: 'Back-in-stock alert removed' });
      } catch {
        if (!mountedRef.current) return;
        showToast({
          variant: 'error',
          title: 'Could not remove this alert. Please try again.',
        });
      } finally {
        if (mountedRef.current) setRemovingId(null);
      }
    },
    [removingId, userEmail],
  );

  const showInitialLoader = loading && subscriptions.length === 0;
  const showEmptyState = !loading && !loadError && subscriptions.length === 0;
  const showErrorState = !loading && Boolean(loadError) && subscriptions.length === 0;

  return (
    <View>
      <AccountCardDivider />

      <View className="px-4 py-3.5">
        <Text variant="body" className="text-ink">
          Back-in-stock alerts
        </Text>
        <Text variant="caption" className="mt-1 text-mist">
          Email alerts when out-of-stock items return
        </Text>
      </View>

      <View className="min-h-[40px]">
        {showInitialLoader ?
          <View className="items-center px-4 pb-4">
            <ActivityIndicator color={palette.accent} />
          </View>
        : showErrorState ?
          <Text variant="caption" className="px-4 pb-4 text-mist">
            {loadError}
          </Text>
        : showEmptyState ?
          <Text variant="caption" className="px-4 pb-4 text-mist">
            You do not have any active back-in-stock alerts.
          </Text>
        : subscriptions.map((subscription, index) => {
            const busy = removingId === subscription.subscriptionId;

            return (
              <View
                key={subscription.subscriptionId}
                className={cn(
                  'flex-row items-center justify-between px-4 py-3.5',
                  index < subscriptions.length - 1 && 'border-b border-line/35',
                )}>
                <View className="min-w-0 flex-1 pr-3">
                  <Text variant="body" className="text-ink" numberOfLines={2}>
                    {subscriptionTitle(subscription)}
                  </Text>
                  <Text variant="caption" className="mt-1 text-mist" numberOfLines={1}>
                    {subscriptionDetail(subscription)}
                  </Text>
                </View>

                <Pressable
                  onPress={() => void onRemove(subscription)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove back-in-stock alert for ${subscriptionTitle(subscription)}`}
                  className="h-5 w-16 shrink-0 items-center justify-center active:opacity-70"
                  hitSlop={8}>
                  <View className="h-5 w-16 items-center justify-center">
                    {busy ?
                      <ActivityIndicator color={palette.mist} size="small" />
                    : <Text variant="caption" className="text-mist underline">
                        Remove
                      </Text>
                    }
                  </View>
                </Pressable>
              </View>
            );
          })
        }
      </View>
    </View>
  );
}
