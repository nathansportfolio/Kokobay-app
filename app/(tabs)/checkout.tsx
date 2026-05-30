import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckoutWebView } from '@/components/checkout/checkout-webview';
import { LuxuryTabBodySpacer } from '@/components/navigation/luxury-tab-body-spacer';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { LUXURY_SYMBOL } from '@/constants/luxury-icons';
import { luxuryChrome } from '@/constants/luxury-nav';
import { palette } from '@/constants/theme';
import { gtmCartValue, trackPurchase } from '@/lib/gtm';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { ensureCartSyncedForCheckout, showToast, useAuthStore, useCartStore } from '@/store';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';
import { accountAuthRoute } from '@/utils/account-navigation';
import { hapticLight } from '@/utils/haptics';
import { resolveCheckoutWebViewUrl } from '@/utils/checkout-url';

function resolveCheckoutUrl(
  param: string | string[] | undefined,
  fromStore: string | null,
  lines: { variantId: string; qty: number; handle: string }[],
  isLoggedIn: boolean,
  awaitingCheckoutUrl: boolean,
): string | null {
  const resumeUrl =
    typeof param === 'string' ? param : Array.isArray(param) ? param[0] : undefined;
  return resolveCheckoutWebViewUrl(fromStore, lines, {
    isLoggedIn,
    resumeUrl,
    awaitingCheckoutUrl,
  });
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { url: urlParam } = useLocalSearchParams<{ url?: string }>();
  const checkoutUrlFromStore = useCartStore((s) => s.checkoutUrl);
  const lines = useCartStore((s) => s.lines);
  const pendingCartSync = useCartStore((s) => s.pendingCartSync);
  const isSyncingShopify = useCartStore((s) => s.isSyncingShopify);
  const clear = useCartStore((s) => s.clear);
  const customerEmail = useAuthStore((s) => s.user?.email);
  const isAppLoggedIn = Boolean(customerEmail?.trim());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const orderConfirmedRef = useRef(false);
  /** Keeps the WebView mounted after the bag is cleared post-purchase. */
  const checkoutSessionUrlRef = useRef<string | null>(null);
  /** One cart sync when opening checkout — not on every `checkoutUrl` store update (avoids sync loop). */
  const initialCartSyncDoneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isRemoteCartConfigured()) {
        if (!cancelled) setBootstrapping(false);
        return;
      }
      if (orderConfirmedRef.current || initialCartSyncDoneRef.current) {
        if (!cancelled) setBootstrapping(false);
        return;
      }
      initialCartSyncDoneRef.current = true;
      const hasLines = useCartStore.getState().lines.length > 0;
      if (hasLines) {
        await ensureCartSyncedForCheckout(customerEmail ?? undefined);
      }
      if (!cancelled) setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [customerEmail]);

  const checkoutBusy = bootstrapping || pendingCartSync || isSyncingShopify;

  useFocusEffect(
    useCallback(() => {
      if (orderConfirmedRef.current || checkoutBusy) return;
      if (lines.length === 0) {
        router.replace('/(tabs)/cart');
      }
    }, [checkoutBusy, lines.length, router]),
  );
  const purchaseComplete = orderConfirmed || orderConfirmedRef.current;

  const linesSignature = useMemo(
    () => lines.map((line) => `${shopifyVariantKey(line.variantId)}:${line.qty}`).join('|'),
    [lines],
  );

  useEffect(() => {
    if (purchaseComplete) return;
    checkoutSessionUrlRef.current = null;
  }, [linesSignature, purchaseComplete]);

  useEffect(() => {
    if (purchaseComplete) return;
    if (checkoutBusy) checkoutSessionUrlRef.current = null;
  }, [checkoutBusy, purchaseComplete]);

  const awaitingCheckoutUrl = isAppLoggedIn && checkoutBusy && !urlParam;

  const checkoutUrl = useMemo(() => {
    if (checkoutBusy) return null;
    const resolved = resolveCheckoutUrl(
      urlParam,
      checkoutUrlFromStore,
      lines,
      isAppLoggedIn,
      awaitingCheckoutUrl,
    );
    if (resolved) {
      checkoutSessionUrlRef.current = resolved;
    }
    return resolved;
  }, [awaitingCheckoutUrl, checkoutBusy, checkoutUrlFromStore, isAppLoggedIn, urlParam, lines]);

  const webViewUrl = purchaseComplete
    ? checkoutSessionUrlRef.current ?? checkoutUrl
    : checkoutUrl;

  useEffect(() => {
    if (!orderConfirmed) return;
    clear();
  }, [clear, orderConfirmed]);

  const onOrderComplete = useCallback(() => {
    if (orderConfirmedRef.current) return;
    orderConfirmedRef.current = true;
    const snapshot = useCartStore.getState().lines;
    const totals = useCartStore.getState();
    trackPurchase({
      lines: snapshot,
      value: gtmCartValue(snapshot) ?? (totals.shopifyTotal ? Number.parseFloat(totals.shopifyTotal.amount) : undefined),
      currency: totals.shopifyTotal?.currencyCode ?? totals.shopifySubtotal?.currencyCode,
    });
    setOrderConfirmed(true);
    showToast({ variant: 'success', title: 'Thank you', description: 'Your order is confirmed.' });
  }, []);

  const goBackToBag = useCallback(() => {
    if (orderConfirmedRef.current) {
      router.replace('/(tabs)');
      return;
    }
    hapticLight();
    router.replace('/(tabs)/cart');
  }, [router]);

  const goToAppCartFromWebView = useCallback(() => {
    hapticLight();
    router.replace('/(tabs)/cart');
  }, [router]);

  const goToAppHomeFromWebView = useCallback(() => {
    hapticLight();
    router.replace('/(tabs)');
  }, [router]);

  const goToAppLoginFromWebView = useCallback(
    (resumeCheckoutUrl: string | null) => {
      hapticLight();
      router.push(
        accountAuthRoute({
          mode: 'signin',
          ...(resumeCheckoutUrl ? { returnTo: resumeCheckoutUrl } : {}),
        }),
      );
    },
    [router],
  );

  const isLoading = checkoutBusy && !purchaseComplete;
  const bagIsEmpty = lines.length === 0;
  const backLabel = purchaseComplete ? 'Continue shopping' : 'Your bag';

  return (
    <SafeAreaView className="flex-1 bg-warmCanvas" edges={['left', 'right']}>
      <LuxuryTabBodySpacer />

      <Pressable
        onPress={goBackToBag}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        className="mb-2 flex-row items-center gap-1 self-start px-[22px] py-2">
        <IconSymbol
          name="chevron.left"
          size={LUXURY_SYMBOL.chromeIconSize}
          color={luxuryChrome.ink}
          weight={LUXURY_SYMBOL.chromeWeight}
        />
        <Text className="font-sans-medium text-[13px] tracking-[-0.2px] text-ink">{backLabel}</Text>
      </Pressable>

      <View style={{ flex: 1, backgroundColor: palette.canvas }}>
        {isLoading && !webViewUrl ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="font-sans text-[14px]" style={{ color: 'rgba(120, 118, 114, 0.88)' }}>
              Preparing checkout…
            </Text>
          </View>
        ) : webViewUrl ? (
          <CheckoutWebView
            url={webViewUrl}
            lines={lines}
            isAppLoggedIn={isAppLoggedIn}
            onOrderComplete={onOrderComplete}
            onNavigateToCart={goToAppCartFromWebView}
            onNavigateToHome={goToAppHomeFromWebView}
            onNavigateToLogin={goToAppLoginFromWebView}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Text className="text-center font-sans text-[15px] leading-[22px] text-ink">
              {bagIsEmpty
                ? 'Your bag is empty. Add something to check out.'
                : 'We couldn\u2019t start checkout from your bag. Try again in a moment.'}
            </Text>
            <Button title="Back to bag" variant="primary" onPress={goBackToBag} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
