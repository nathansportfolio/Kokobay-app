import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { BlurView } from 'expo-blur';

const BLUR_SUPPORTED = Platform.OS === 'ios';

import { Button } from '@/components/ui/button';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { trackBeginCheckout } from '@/lib/gtm';
import { ensureCartSyncedForCheckout, showToast, useAuthStore, useCartStore } from '@/store';
import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';
import { formatCartMoney } from '@/utils/money';
import { resolveCheckoutWebViewUrl } from '@/utils/checkout-url';

type Money = { amount: string; currencyCode: string };

type Props = {
  subtotal: Money;
  delivery: Money | null;
  tax?: Money | null;
  usesShopifyCheckout?: boolean;
  /** From CMS `delivery_threshold`; defaults to 100. */
  freeDeliveryThresholdGbp?: number;
  /** Breathing room above the scene bottom. On tab routes the scene already clears the tab bar — use ~8–12px (see cart screen). */
  bottomInset: number;
};

const rowLabel: TextStyle = {
  fontFamily: 'InstrumentSans-Medium',
  fontSize: 11,
  letterSpacing: 2,
  color: 'rgba(92, 91, 88, 0.75)',
  textTransform: 'uppercase',
};

const rowValue: TextStyle = {
  fontFamily: 'InstrumentSans-Medium',
  fontSize: 13,
  letterSpacing: -0.2,
  color: 'rgba(20, 20, 20, 0.88)',
};

const DELIVERY_AT_CHECKOUT_LABEL = 'On Checkout';

export function CartCheckoutBar({
  subtotal,
  delivery,
  tax = null,
  usesShopifyCheckout = false,
  freeDeliveryThresholdGbp,
  bottomInset,
}: Props) {
  const [checkingOut, setCheckingOut] = useState(false);

  const freeDeliveryThreshold =
    freeDeliveryThresholdGbp != null &&
    Number.isFinite(freeDeliveryThresholdGbp) &&
    freeDeliveryThresholdGbp > 0
      ? freeDeliveryThresholdGbp
      : DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;

  const subtotalN = Number.parseFloat(subtotal.amount);
  const showOrderSummary = Number.isFinite(subtotalN) && subtotalN > 0;
  const qualifiesForFreeDelivery =
    Number.isFinite(subtotalN) && subtotalN >= freeDeliveryThreshold;
  const deliveryN = delivery ? Number.parseFloat(delivery.amount) : NaN;
  const deliveryIsKnown = delivery && Number.isFinite(deliveryN);
  const deliveryIsFree = deliveryIsKnown && deliveryN <= 0.005;
  const deliveryValueLabel = qualifiesForFreeDelivery
    ? 'Free'
    : deliveryIsKnown
      ? deliveryIsFree
        ? usesShopifyCheckout
          ? DELIVERY_AT_CHECKOUT_LABEL
          : 'Free'
        : formatCartMoney(delivery)
      : usesShopifyCheckout
        ? DELIVERY_AT_CHECKOUT_LABEL
        : '—';
  const taxN = tax ? Number.parseFloat(tax.amount) : 0;
  const showTax = Boolean(tax && Number.isFinite(taxN) && taxN > 0.005);

  const onCheckout = useCallback(async () => {
    if (!isRemoteCartConfigured()) return;
    setCheckingOut(true);
    try {
      const customerEmail = useAuthStore.getState().user?.email?.trim();
      const isLoggedIn = Boolean(customerEmail);
      await ensureCartSyncedForCheckout(customerEmail ?? undefined);

      const { lines, checkoutUrl, pendingCartSync, isSyncingShopify } = useCartStore.getState();
      const checkoutStillPending = pendingCartSync || isSyncingShopify;
      const checkoutTarget = resolveCheckoutWebViewUrl(checkoutUrl, lines, {
        isLoggedIn,
        awaitingCheckoutUrl: checkoutStillPending || (isLoggedIn && !checkoutUrl?.trim()),
      });

      if (!checkoutTarget) {
        showToast({
          variant: 'error',
          title: 'Couldn\u2019t start checkout',
          description: 'Check your bag and try again.',
        });
        return;
      }
      trackBeginCheckout(lines);
      router.push('/checkout');
    } finally {
      setCheckingOut(false);
    }
  }, []);

  const shell = (
    <View style={[styles.inner, { paddingBottom: 16 }]}>
      {showOrderSummary ? (
        <View className="mb-2 gap-1">
          <View className="flex-row items-center justify-between gap-4">
            <Text style={rowLabel}>
              {usesShopifyCheckout && delivery ? 'Delivery' : 'Delivery estimate'}
            </Text>
            <Text style={rowValue}>{deliveryValueLabel}</Text>
          </View>
          {showTax ? (
            <View className="flex-row items-center justify-between gap-4">
              <Text style={rowLabel}>Tax</Text>
              <Text style={rowValue}>{formatCartMoney(tax!)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View className="mb-4 flex-row items-end justify-between gap-4">
        <Text
          style={{
            fontFamily: 'InstrumentSans-Medium',
            fontSize: 11,
            letterSpacing: 2,
            color: 'rgba(92, 91, 88, 0.75)',
            textTransform: 'uppercase',
          }}>
          Subtotal
        </Text>
        <Text
          style={{
            fontFamily: 'InstrumentSans-SemiBold',
            fontSize: 26,
            letterSpacing: -0.6,
            color: '#141414',
          }}>
          {formatCartMoney(subtotal)}
        </Text>
      </View>
      <Button
        title="Checkout"
        variant="primary"
        loading={checkingOut}
        disabled={!usesShopifyCheckout || checkingOut}
        onPress={onCheckout}
      />
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.float, { paddingBottom: bottomInset, paddingHorizontal: 20 }]}>
      {BLUR_SUPPORTED ? (
        <BlurView intensity={55} tint="light" style={styles.blurShell}>
          {shell}
        </BlurView>
      ) : (
        <View style={[styles.blurShell, styles.blurFallback]}>{shell}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  float: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
  blurShell: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20, 20, 20, 0.06)',
    backgroundColor: BLUR_SUPPORTED ? 'transparent' : undefined,
  },
  blurFallback: {
    backgroundColor: 'rgba(250, 248, 245, 0.94)',
  },
  inner: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
});
