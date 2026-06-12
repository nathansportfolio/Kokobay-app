import { FlashList } from '@shopify/flash-list';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartCheckoutBar } from '@/components/cart/cart-checkout-bar';
import { CartFreeDeliveryProgress } from '@/components/cart/cart-free-delivery-progress';
import { CartLineRow } from '@/components/cart/cart-line-row';
import { LuxuryTabBodySpacer } from '@/components/navigation/luxury-tab-body-spacer';
import { LUXURY_TAB_SCREEN_EYEBROW_CLASS } from '@/components/navigation/luxury-tab-screen-header';
import { TabScreenTouchRoot } from '@/components/navigation/tab-screen-touch-root';
import { Button } from '@/components/ui/button';
import { CartLineSkeleton } from '@/components/ui/cart-line-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCartPricingAuditScreen } from '@/hooks/use-cart-pricing-audit';
import { useCartScreenState } from '@/hooks/use-cart-screen-state';
import { useAppCartDeliveryTextLabel } from '@/hooks/use-app-cart-delivery-text-query';
import { useDeliveryThreshold } from '@/hooks/use-delivery-threshold';
import { useLuxuryTabContentBottomPadding } from '@/hooks/use-optional-bottom-tab-bar-height';
import { useLifecycleRenderCount } from '@/hooks/use-lifecycle-render-count';
import { useRenderTrace } from '@/hooks/use-render-trace';
import { useScreenLoadTrace } from '@/hooks/use-screen-load-trace';
import { trackViewCart } from '@/lib/gtm';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { useCartStore } from '@/store';
import { useMarketStore } from '@/store/market-preference';
import type { CartLine } from '@/types/cart';
import { resolveCartCostBreakdownForDisplay } from '@/utils/cart-cost-breakdown';
import { cn } from '@/utils/cn';

/** Space below list so last lines clear the floating checkout card (card + air). */
const FLOATING_CHECKOUT_CLEARANCE = 132 + 100;

/** Inline shell — NativeWind flex-1 does not reliably apply on Android scroll/safe-area wrappers. */
const CART_SHELL = { flex: 1, backgroundColor: '#FAF8F5' } as const;
const CART_SCROLL_CONTENT = {
  flexGrow: 1,
  paddingHorizontal: 22,
  paddingBottom: 64,
  paddingTop: 8,
} as const;

export default function CartScreen() {
  return (
    <TabScreenTouchRoot>
      <CartScreenContent />
    </TabScreenTouchRoot>
  );
}

function CartScreenContent() {
  useLifecycleRenderCount('cart');
  useRenderTrace('Cart');
  const checkoutBottomInset = useLuxuryTabContentBottomPadding();
  const {
    lines,
    hasHydrated,
    bagUnitCount,
    quantitySyncPendingByVariantId,
    cartPricingForDisplay,
    overServerSubtotalVariantId,
  } = useCartScreenState();
  const marketCurrency = useMarketStore((s) => s.currencyCode);
  const marketCountryCode = useMarketStore((s) => s.countryCode);
  const freeDeliveryThresholdGbp = useDeliveryThreshold();
  const deliveryAtCheckoutLabel = useAppCartDeliveryTextLabel();
  const usesShopifyCheckout = isRemoteCartConfigured();
  const costBreakdown = useMemo(
    () =>
      resolveCartCostBreakdownForDisplay({
        lines,
        shopifySubtotal: cartPricingForDisplay.shopifySubtotal,
        shopifyTotal: cartPricingForDisplay.shopifyTotal,
        shopifyTotalTax: cartPricingForDisplay.shopifyTotalTax,
        shopifyDiscountCodes: cartPricingForDisplay.shopifyDiscountCodes,
        shopifyLineMerchandiseSubtotal: cartPricingForDisplay.shopifyLineMerchandiseSubtotal,
        shopifyLineMerchandiseTotal: cartPricingForDisplay.shopifyLineMerchandiseTotal,
        shopifyCartDiscountAmount: cartPricingForDisplay.shopifyCartDiscountAmount,
        usesShopifyCheckout,
        marketCurrency,
        freeDeliveryThresholdGbp,
      }),
    [
      lines,
      cartPricingForDisplay.shopifySubtotal,
      cartPricingForDisplay.shopifyTotal,
      cartPricingForDisplay.shopifyTotalTax,
      cartPricingForDisplay.shopifyDiscountCodes,
      cartPricingForDisplay.shopifyLineMerchandiseSubtotal,
      cartPricingForDisplay.shopifyLineMerchandiseTotal,
      cartPricingForDisplay.shopifyCartDiscountAmount,
      usesShopifyCheckout,
      marketCurrency,
      freeDeliveryThresholdGbp,
    ],
  );

  useCartPricingAuditScreen({
    lines,
    marketCurrency,
    costBreakdown,
    freeDeliveryThresholdGbp,
    usesShopifyCheckout,
    bagUnitCount,
  });

  const viewCartVisitTrackedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      viewCartVisitTrackedRef.current = false;

      const tryTrackViewCart = () => {
        if (viewCartVisitTrackedRef.current) return;
        const state = useCartStore.getState();
        if (!state.hasHydrated || state.lines.length === 0) return;
        viewCartVisitTrackedRef.current = true;
        trackViewCart(state.lines);
      };

      tryTrackViewCart();

      return () => {
        viewCartVisitTrackedRef.current = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!hasHydrated || lines.length === 0 || viewCartVisitTrackedRef.current) return;
    viewCartVisitTrackedRef.current = true;
    trackViewCart(lines);
  }, [hasHydrated]);

  const renderItem = useCallback(
    ({ item }: { item: CartLine }) => {
      const variantKey = item.variantId.trim();
      return (
        <CartLineRow
          line={item}
          qtySyncPending={Boolean(quantitySyncPendingByVariantId[variantKey])}
          showOverServerSubtotalWarning={overServerSubtotalVariantId === item.variantId}
        />
      );
    },
    [quantitySyncPendingByVariantId, overServerSubtotalVariantId],
  );

  const listHeader = useMemo(
    () => (
      <>
        <CartBagScreenHeader bagUnitCount={bagUnitCount} />
        <CartFreeDeliveryProgress
          subtotal={costBreakdown.subtotal}
          freeDeliveryThresholdGbp={freeDeliveryThresholdGbp}
        />
      </>
    ),
    [bagUnitCount, costBreakdown.subtotal, freeDeliveryThresholdGbp],
  );

  const listBottomPad = FLOATING_CHECKOUT_CLEARANCE + checkoutBottomInset;

  let renderBranch = 'content';
  if (!hasHydrated) renderBranch = 'skeleton';
  else if (lines.length === 0) renderBranch = 'empty';

  useScreenLoadTrace({
    screen: 'cart',
    routeKey: 'cart-tab',
    showSkeleton: renderBranch === 'skeleton',
    showContent: renderBranch === 'content',
    branch: renderBranch,
    extra: {
      hasHydrated,
      lineCount: lines.length,
    },
    queries: [],
  });

  if (!hasHydrated) {
    return (
      <SafeAreaView style={CART_SHELL} edges={['left', 'right']}>
        <ScrollView
          style={CART_SHELL}
          contentContainerStyle={CART_SCROLL_CONTENT}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <CartBagScreenHeader bagUnitCount={0} />
          <CartLineSkeleton />
          <CartLineSkeleton />
          <CartLineSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Hydrated empty bag: View shell — ScrollView after hydrate blanks on Android.
  if (lines.length === 0) {
    return (
      <SafeAreaView style={CART_SHELL} edges={['left', 'right']}>
        <View style={CART_SHELL}>
          <View className="px-[22px]">
            <CartBagScreenHeader bagUnitCount={0} />
          </View>
          <EmptyState
            title="Your bag is empty"
            message="When you add items to your cart, they will show here">
            <Link href="/categories" asChild>
              <Button title="Browse" variant="primary" className="mt-2 px-10" />
            </Link>
          </EmptyState>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={CART_SHELL} edges={['left', 'right']}>
      <View style={CART_SHELL}>
        <FlashList
          style={{ flex: 1 }}
          data={lines}
          keyExtractor={(l) => `${l.handle}-${l.variantId}`}
          renderItem={renderItem}
          drawDistance={420}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: listBottomPad,
          }}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <CartCheckoutBar
            subtotal={costBreakdown.subtotal}
            total={costBreakdown.total}
            appliedDiscounts={costBreakdown.appliedDiscounts}
            delivery={costBreakdown.delivery}
            tax={costBreakdown.tax}
            usesShopifyCheckout={usesShopifyCheckout}
            freeDeliveryThresholdGbp={freeDeliveryThresholdGbp}
            deliveryAtCheckoutLabel={deliveryAtCheckoutLabel}
            marketCountryCode={marketCountryCode}
            bottomInset={checkoutBottomInset}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function CartBagScreenHeader({ bagUnitCount }: { bagUnitCount: number }) {
  const itemLabel = bagUnitCount === 1 ? 'item' : 'items';

  return (
    <>
      <LuxuryTabBodySpacer />
      <View className="mb-8 flex-row items-baseline justify-between gap-4">
        <Text className={cn(LUXURY_TAB_SCREEN_EYEBROW_CLASS, 'mb-0')}>Your bag</Text>
        <Text
          className="shrink-0 font-sans text-[14px] leading-[21px]"
          style={{ color: 'rgba(120, 118, 114, 0.88)' }}>
          {bagUnitCount} {itemLabel}
        </Text>
      </View>
    </>
  );
}
