import { router } from 'expo-router';
import { useCartPricingAuditCheckoutBar } from '@/hooks/use-cart-pricing-audit';
import { useRenderTrace } from '@/hooks/use-render-trace';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { BlurView } from 'expo-blur';

const BLUR_SUPPORTED = Platform.OS === 'ios';

import { Button } from '@/components/ui/button';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { trackBeginCheckout } from '@/lib/gtm';
import { ensureCartSyncedForCheckout, showToast, useAuthStore, useCartStore } from '@/store';
import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';
import { formatCartDiscountRowLabel } from '@/constants/first-app-order-discount';
import { formatCartMoney } from '@/utils/money';
import { resolveCheckoutWebViewUrl } from '@/utils/checkout-url';
import type { CartAppliedDiscount } from '@/utils/cart-cost-breakdown';

type Money = { amount: string; currencyCode: string };

type Props = {
  subtotal: Money;
  appliedDiscounts?: CartAppliedDiscount[];
  /** Merchandise total after discounts (before delivery). */
  merchandiseTotal?: Money;
  delivery: Money | null;
  tax?: Money | null;
  usesShopifyCheckout?: boolean;
  /** From CMS `delivery_threshold`; defaults to 100. */
  freeDeliveryThresholdGbp?: number;
  marketCountryCode?: string;
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

const DELIVERY_AT_CHECKOUT_LABEL = 'Calculated on checkout';

function isUkDeliveryMarket(subtotal: Money, marketCountryCode?: string): boolean {
  if (marketCountryCode?.trim().toUpperCase() === 'GB') return true;
  return subtotal.currencyCode.trim().toUpperCase() === 'GBP';
}

function resolveDeliveryValueLabel(options: {
  subtotal: Money;
  delivery: Money | null;
  usesShopifyCheckout: boolean;
  freeDeliveryThresholdGbp: number;
  marketCountryCode?: string;
}): string {
  const subtotalN = Number.parseFloat(options.subtotal.amount);
  const qualifiesForFreeUkDelivery =
    isUkDeliveryMarket(options.subtotal, options.marketCountryCode) &&
    Number.isFinite(subtotalN) &&
    subtotalN >= options.freeDeliveryThresholdGbp;

  if (qualifiesForFreeUkDelivery) return 'Free';

  if (options.usesShopifyCheckout) {
    return DELIVERY_AT_CHECKOUT_LABEL;
  }

  const deliveryN = options.delivery ? Number.parseFloat(options.delivery.amount) : NaN;
  const deliveryIsKnown = options.delivery && Number.isFinite(deliveryN);
  if (deliveryIsKnown && deliveryN <= 0.005) return 'Free';
  if (deliveryIsKnown) return formatCartMoney(options.delivery!);
  return '—';
}

export function CartCheckoutBar({
  subtotal,
  appliedDiscounts = [],
  merchandiseTotal,
  delivery,
  tax = null,
  usesShopifyCheckout = false,
  freeDeliveryThresholdGbp,
  marketCountryCode,
  bottomInset,
}: Props) {
  useRenderTrace('CheckoutBar');
  const [checkingOut, setCheckingOut] = useState(false);

  useCartPricingAuditCheckoutBar({
    subtotal,
    total: merchandiseTotal ?? subtotal,
    appliedDiscountCount: appliedDiscounts.length,
  });

  const freeDeliveryThreshold =
    freeDeliveryThresholdGbp != null &&
    Number.isFinite(freeDeliveryThresholdGbp) &&
    freeDeliveryThresholdGbp > 0
      ? freeDeliveryThresholdGbp
      : DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;

  const subtotalN = Number.parseFloat(subtotal.amount);
  const showOrderSummary = Number.isFinite(subtotalN) && subtotalN > 0;
  const deliveryValueLabel = resolveDeliveryValueLabel({
    subtotal,
    delivery,
    usesShopifyCheckout,
    freeDeliveryThresholdGbp: freeDeliveryThreshold,
    marketCountryCode,
  });
  const taxN = tax ? Number.parseFloat(tax.amount) : 0;
  const showTax = Boolean(tax && Number.isFinite(taxN) && taxN > 0.005);
  const hasAppliedDiscounts = appliedDiscounts.length > 0;
  const heroMerchandiseTotal = hasAppliedDiscounts && merchandiseTotal ? merchandiseTotal : subtotal;
  const showPreDiscountSubtotal = hasAppliedDiscounts;

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
          {showPreDiscountSubtotal ? (
            <View className="flex-row items-center justify-between gap-4">
              <Text style={rowLabel}>Subtotal</Text>
              <Text style={rowValue}>{formatCartMoney(subtotal)}</Text>
            </View>
          ) : null}
          {appliedDiscounts.map((discount) => {
            const discountN = Number.parseFloat(discount.amount.amount);
            const showAmount = Number.isFinite(discountN) && discountN > 0.005;
            return (
              <View
                key={discount.code}
                className="flex-row items-center justify-between gap-4">
                <Text style={rowLabel}>{formatCartDiscountRowLabel(discount.code)}</Text>
                {showAmount ? (
                  <Text style={rowValue}>-{formatCartMoney(discount.amount)}</Text>
                ) : (
                  <Text style={rowValue}>Applied</Text>
                )}
              </View>
            );
          })}
          <View className="flex-row items-center justify-between gap-4">
            <Text style={rowLabel}>Delivery</Text>
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
          {hasAppliedDiscounts ? 'Total' : 'Subtotal'}
        </Text>
        <Text
          style={{
            fontFamily: 'InstrumentSans-SemiBold',
            fontSize: 26,
            letterSpacing: -0.6,
            color: '#141414',
          }}>
          {formatCartMoney(heroMerchandiseTotal)}
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
