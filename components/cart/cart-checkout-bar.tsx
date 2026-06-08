import { useCartPricingAuditCheckoutBar } from '@/hooks/use-cart-pricing-audit';
import { useRenderTrace } from '@/hooks/use-render-trace';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { BlurView } from 'expo-blur';

const BLUR_SUPPORTED = Platform.OS === 'ios';

import { Button } from '@/components/ui/button';
import { openCheckoutFromBag } from '@/lib/open-checkout';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { DEFAULT_FREE_DELIVERY_THRESHOLD_GBP } from '@/constants/delivery-threshold';
import { DEFAULT_CART_DELIVERY_AT_CHECKOUT_LABEL } from '@/constants/app-cart-delivery-text-cms';
import { formatCartMoney } from '@/utils/money';
import type { CartAppliedDiscount } from '@/utils/cart-cost-breakdown';

type Money = { amount: string; currencyCode: string };

type Props = {
  subtotal: Money;
  total: Money;
  appliedDiscounts?: CartAppliedDiscount[];
  delivery: Money | null;
  tax?: Money | null;
  usesShopifyCheckout?: boolean;
  /** From CMS `delivery_threshold`; defaults to 100. */
  freeDeliveryThresholdGbp?: number;
  /** From CMS `app_cart_delivery_text`; defaults to "Calculated on checkout". */
  deliveryAtCheckoutLabel?: string;
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
  deliveryAtCheckoutLabel: string;
}): string {
  const subtotalN = Number.parseFloat(options.subtotal.amount);
  const qualifiesForFreeUkDelivery =
    isUkDeliveryMarket(options.subtotal, options.marketCountryCode) &&
    Number.isFinite(subtotalN) &&
    subtotalN >= options.freeDeliveryThresholdGbp;

  if (qualifiesForFreeUkDelivery) return 'Free';

  if (options.usesShopifyCheckout) {
    return options.deliveryAtCheckoutLabel;
  }

  const deliveryN = options.delivery ? Number.parseFloat(options.delivery.amount) : NaN;
  const deliveryIsKnown = options.delivery && Number.isFinite(deliveryN);
  if (deliveryIsKnown && deliveryN <= 0.005) return 'Free';
  if (deliveryIsKnown) return formatCartMoney(options.delivery!);
  return '—';
}

function formatDiscountAmount(amount: Money): string {
  const value = Number.parseFloat(amount.amount);
  if (!Number.isFinite(value) || value <= 0) return formatCartMoney(amount);
  return `−${formatCartMoney({ amount: value.toFixed(2), currencyCode: amount.currencyCode })}`;
}

export function CartCheckoutBar({
  subtotal,
  total,
  appliedDiscounts = [],
  delivery,
  tax = null,
  usesShopifyCheckout = false,
  freeDeliveryThresholdGbp,
  deliveryAtCheckoutLabel = DEFAULT_CART_DELIVERY_AT_CHECKOUT_LABEL,
  marketCountryCode,
  bottomInset,
}: Props) {
  useRenderTrace('CheckoutBar');
  const [checkingOut, setCheckingOut] = useState(false);

  useCartPricingAuditCheckoutBar({
    subtotal,
    total,
    appliedDiscountCount: appliedDiscounts.length,
  });

  const freeDeliveryThreshold =
    freeDeliveryThresholdGbp != null &&
    Number.isFinite(freeDeliveryThresholdGbp) &&
    freeDeliveryThresholdGbp > 0
      ? freeDeliveryThresholdGbp
      : DEFAULT_FREE_DELIVERY_THRESHOLD_GBP;

  const subtotalN = Number.parseFloat(subtotal.amount);
  const totalN = Number.parseFloat(total.amount);
  const showOrderSummary = Number.isFinite(subtotalN) && subtotalN > 0;
  const hasDiscount = appliedDiscounts.length > 0;
  const discountAmount = hasDiscount ? appliedDiscounts[0]?.amount ?? null : null;
  const deliveryValueLabel = resolveDeliveryValueLabel({
    subtotal,
    delivery,
    usesShopifyCheckout,
    freeDeliveryThresholdGbp: freeDeliveryThreshold,
    marketCountryCode,
    deliveryAtCheckoutLabel,
  });
  const taxN = tax ? Number.parseFloat(tax.amount) : 0;
  const showTax = Boolean(tax && Number.isFinite(taxN) && taxN > 0.005);
  const footerAmount = hasDiscount && Number.isFinite(totalN) && totalN > 0 ? total : subtotal;
  const footerLabel = hasDiscount ? 'Total' : 'Subtotal';

  const onCheckout = useCallback(async () => {
    if (!isRemoteCartConfigured()) return;
    setCheckingOut(true);
    try {
      await openCheckoutFromBag();
    } finally {
      setCheckingOut(false);
    }
  }, []);

  const shell = (
    <View style={[styles.inner, { paddingBottom: 16 }]}>
      {showOrderSummary ? (
        <View className="mb-2 gap-1">
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
          {hasDiscount ? (
            <>
              <View className="flex-row items-center justify-between gap-4">
                <Text style={rowLabel}>Subtotal</Text>
                <Text style={rowValue}>{formatCartMoney(subtotal)}</Text>
              </View>
              {discountAmount ? (
                <View className="flex-row items-center justify-between gap-4">
                  <Text style={rowLabel}>Discount</Text>
                  <Text style={[rowValue, { color: 'rgba(20, 20, 20, 0.72)' }]}>
                    {formatDiscountAmount(discountAmount)}
                  </Text>
                </View>
              ) : null}
            </>
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
          {footerLabel}
        </Text>
        <Text
          style={{
            fontFamily: 'InstrumentSans-SemiBold',
            fontSize: 26,
            letterSpacing: -0.6,
            color: '#141414',
          }}>
          {formatCartMoney(footerAmount)}
        </Text>
      </View>
      <Button
        title={checkingOut ? 'Updating your bag…' : 'Checkout'}
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
