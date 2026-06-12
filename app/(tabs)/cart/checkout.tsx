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
import { markCheckoutTiming } from '@/lib/checkout-timing';
import { logCheckoutTrace } from '@/lib/checkout-trace';
import { logShopifyRedirectTraceSource } from '@/lib/shopify-redirect-trace';
import {
  checkoutBootstrapRequiredReason,
  checkoutPreSyncTokenAgeMs,
  clearCheckoutPreSyncToken,
  shouldSkipCheckoutBootstrap,
} from '@/lib/checkout-session';
import { gtmCartValue, trackPurchase } from '@/lib/gtm';
import { isRemoteCartConfigured } from '@/services/cart/remote-cart';
import { useLifecycleRenderCount } from '@/hooks/use-lifecycle-render-count';
import { openCheckoutExternallyOrShowUnavailable } from '@/lib/open-checkout';
import { cartEngine } from '@/src/core/cart';
import { useAuth } from '@/hooks/use-auth';
import { showToast, useCartStore } from '@/store';
import { getCartRevisionSnapshot } from '@/store/cart';
import { showCheckoutUnavailableModal } from '@/store/checkout-unavailable-modal';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';
import { accountAuthRoute } from '@/utils/account-navigation';
import { hapticLight } from '@/utils/haptics';
import { assertCheckoutAvailable } from '@/utils/checkout-health';
import { logCheckoutUrl, resolveCheckoutWebViewUrl } from '@/utils/checkout-url';

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
  useLifecycleRenderCount('checkout');
  const router = useRouter();
  const { url: urlParam } = useLocalSearchParams<{ url?: string }>();
  const checkoutUrlFromStore = useCartStore((s) => s.storeCheckoutUrl ?? s.checkoutUrl);
  const lines = useCartStore((s) => s.lines);
  const pendingCartSync = useCartStore((s) => s.pendingCartSync);
  const isSyncingShopify = useCartStore((s) => s.isSyncingShopify);
  const { user } = useAuth();
  const customerEmail = user?.email;
  const isAppLoggedIn = Boolean(customerEmail?.trim());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [checkoutSyncFailed, setCheckoutSyncFailed] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [checkoutUnavailable, setCheckoutUnavailable] = useState(false);
  const orderConfirmedRef = useRef(false);
  /** Keeps the WebView mounted after the bag is cleared post-purchase. */
  const checkoutSessionUrlRef = useRef<string | null>(null);
  /** One cart sync when opening checkout — not on every `checkoutUrl` store update (avoids sync loop). */
  const initialCartSyncDoneRef = useRef(false);

  useEffect(() => {
    markCheckoutTiming('checkout_screen_mounted');
    logCheckoutTrace('checkout_screen_mounted');
  }, []);

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
      const { cartRevision } = getCartRevisionSnapshot();
      if (hasLines && shouldSkipCheckoutBootstrap(cartRevision)) {
        console.log('[CHECKOUT_BOOTSTRAP] skipped', {
          cartRevision,
          tokenAgeMs: checkoutPreSyncTokenAgeMs(),
        });
        clearCheckoutPreSyncToken();
        if (!cancelled) setBootstrapping(false);
        return;
      }
      if (hasLines) {
        console.log('[CHECKOUT_BOOTSTRAP] required', {
          reason: checkoutBootstrapRequiredReason(cartRevision),
        });
        const synced = await cartEngine.checkout(customerEmail ?? undefined);
        if (!cancelled && !synced) {
          setCheckoutSyncFailed(true);
        }
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
  const bagIsEmpty = lines.length === 0;
  const checkoutBlocked = checkoutSyncFailed || (checkoutBusy && !webViewUrl);

  const retryCheckoutOpen = useCallback(() => {
    setCheckoutUnavailable(false);
    initialCartSyncDoneRef.current = false;
    setBootstrapping(true);
    void (async () => {
      const hasLines = useCartStore.getState().lines.length > 0;
      if (hasLines) {
        const synced = await cartEngine.checkout(customerEmail ?? undefined);
        if (!synced) {
          setCheckoutSyncFailed(true);
        } else {
          setCheckoutSyncFailed(false);
        }
      }
      setBootstrapping(false);
    })();
  }, [customerEmail]);

  useEffect(() => {
    if (checkoutBusy || purchaseComplete) return;
    if (!webViewUrl) {
      if (!bagIsEmpty && !checkoutBusy) {
        setCheckoutUnavailable(true);
        showCheckoutUnavailableModal({ onTryAgain: retryCheckoutOpen });
      }
      return;
    }
    logCheckoutTrace('webview_url_set', { webViewUrl });
    logShopifyRedirectTraceSource('webview_resolved', {
      checkoutUrl: checkoutUrlFromStore,
      storeCheckoutUrl: checkoutUrlFromStore,
      url: webViewUrl,
      outputUrl: webViewUrl,
    });
    if (!assertCheckoutAvailable(webViewUrl, { source: 'checkout_screen' })) {
      setCheckoutUnavailable(true);
      showCheckoutUnavailableModal({ onTryAgain: retryCheckoutOpen });
      return;
    }
    setCheckoutUnavailable(false);
    logCheckoutUrl('checkout_screen', webViewUrl, {
      storeCheckoutUrl: checkoutUrlFromStore,
      fromParam: Boolean(urlParam),
      isAppLoggedIn,
      checkoutBusy,
    });
  }, [
    webViewUrl,
    checkoutUrlFromStore,
    urlParam,
    isAppLoggedIn,
    checkoutBusy,
    purchaseComplete,
    bagIsEmpty,
    retryCheckoutOpen,
  ]);

  useEffect(() => {
    if (!orderConfirmed) return;
    cartEngine.clear();
  }, [orderConfirmed]);

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
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/cart');
  }, [router]);

  const goToAppCartFromWebView = useCallback(() => {
    hapticLight();
    if (router.canGoBack()) {
      router.back();
      return;
    }
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
        {checkoutBlocked && !purchaseComplete ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="font-sans text-[14px]" style={{ color: 'rgba(120, 118, 114, 0.88)' }}>
              {checkoutSyncFailed
                ? 'We couldn\u2019t sync your bag with Shopify. Try again in a moment.'
                : 'Updating your bag…'}
            </Text>
          </View>
        ) : webViewUrl && !checkoutUnavailable ? (
          <CheckoutWebView
            url={webViewUrl}
            lines={lines}
            isAppLoggedIn={isAppLoggedIn}
            onOrderComplete={onOrderComplete}
            onNavigateToCart={goToAppCartFromWebView}
            onNavigateToHome={goToAppHomeFromWebView}
            onNavigateToLogin={goToAppLoginFromWebView}
            onCheckoutOpenFailed={() => {
              setCheckoutUnavailable(true);
              void openCheckoutExternallyOrShowUnavailable(webViewUrl, {
                onTryAgain: retryCheckoutOpen,
              });
            }}
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
