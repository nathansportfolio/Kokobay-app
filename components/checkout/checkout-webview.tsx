import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import { reportOperationalFailure } from '@/lib/appErrorLog';
import type { CartLine } from '@/types/cart';
import {
  isCheckoutThankYouUrl,
  isWebViewSubresourceUrl,
  resolveCheckoutResumeUrlFromLoginPage,
  shouldRedirectCheckoutToAppCart,
  shouldRedirectCheckoutToAppHome,
  shouldRedirectCheckoutToAppLogin,
} from '@/utils/checkout-url';

function logCheckout(_event: string, _detail: Record<string, unknown>) {}

type Props = {
  url: string;
  lines?: CartLine[];
  /** App account signed in — do not send Shopify login to native sign-in again. */
  isAppLoggedIn?: boolean;
  onOrderComplete?: () => void;
  onNavigateToCart: () => void;
  onNavigateToHome: () => void;
  onNavigateToLogin: (resumeCheckoutUrl: string | null) => void;
};

type NativeWebViewProps = {
  source: { uri: string };
  onLoadStart: () => void;
  onLoadEnd: () => void;
  onNavigationStateChange: (nav: { url: string; loading?: boolean; canGoBack?: boolean }) => void;
  onShouldStartLoadWithRequest: (request: { url: string }) => boolean;
  onError?: (event: { nativeEvent: { description?: string; code?: number; url?: string } }) => void;
  onHttpError?: (event: {
    nativeEvent: { statusCode?: number; description?: string; url?: string };
  }) => void;
  sharedCookiesEnabled: boolean;
  thirdPartyCookiesEnabled: boolean;
  setSupportMultipleWindows: boolean;
  allowsBackForwardNavigationGestures: boolean;
  style: object;
};

function loadNativeWebView(): React.ComponentType<NativeWebViewProps> | null {
  try {
    return require('react-native-webview').WebView as React.ComponentType<NativeWebViewProps>;
  } catch {
    return null;
  }
}

function CheckoutWebViewFallback({ url }: { url: string }) {
  const [opening, setOpening] = useState(false);

  const openExternal = useCallback(async () => {
    setOpening(true);
    try {
      await openBrowserAsync(url, {
        presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
      });
    } finally {
      setOpening(false);
    }
  }, [url]);

  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Text className="text-center font-sans text-[15px] leading-[22px] text-ink">
        In-app checkout needs a fresh dev build with WebView installed. Run{' '}
        <Text className="font-sans-semibold">pnpm ios:build</Text> once, then reopen the app.
      </Text>
      <Button
        title={opening ? 'Opening…' : 'Open checkout in browser'}
        variant="primary"
        disabled={opening}
        onPress={openExternal}
      />
    </View>
  );
}

function CheckoutWebViewNative({
  url,
  isAppLoggedIn = false,
  onOrderComplete,
  onNavigateToCart,
  onNavigateToHome,
  onNavigateToLogin,
  WebViewComponent,
}: Props & { WebViewComponent: React.ComponentType<NativeWebViewProps> }) {
  const [loading, setLoading] = useState(true);
  const completedRef = useRef(false);
  const cartRedirectRef = useRef(false);
  const homeRedirectRef = useRef(false);
  const loginRedirectRef = useRef(false);
  const currentUrlRef = useRef(url);

  useEffect(() => {
    currentUrlRef.current = url;
    cartRedirectRef.current = false;
    homeRedirectRef.current = false;
    loginRedirectRef.current = false;
    logCheckout('mount', { initialUrl: url });
  }, [url]);

  const logUrl = useCallback((event: string, targetUrl: string, extra?: Record<string, unknown>) => {
    logCheckout(event, {
      url: targetUrl,
      redirectToAppCart: shouldRedirectCheckoutToAppCart(targetUrl),
      redirectToAppHome: shouldRedirectCheckoutToAppHome(targetUrl),
      redirectToAppLogin: shouldRedirectCheckoutToAppLogin(targetUrl),
      thankYou: isCheckoutThankYouUrl(targetUrl),
      ...extra,
    });
  }, []);

  /** Login only — cart/home stay in `onShouldStartLoadWithRequest` to avoid redirect loops. */
  const redirectToLoginIfNeeded = useCallback(
    (targetUrl: string): boolean => {
      if (isAppLoggedIn) return false;
      if (!shouldRedirectCheckoutToAppLogin(targetUrl)) return false;
      if (loginRedirectRef.current) return true;

      loginRedirectRef.current = true;
      const resumeCheckoutUrl = resolveCheckoutResumeUrlFromLoginPage(targetUrl);
      logCheckout('redirect', { to: 'app-login', url: targetUrl, resumeCheckoutUrl });
      onNavigateToLogin(resumeCheckoutUrl);
      return true;
    },
    [isAppLoggedIn, onNavigateToLogin],
  );

  /** Clear the app bag when thank-you loads; keep the WebView on Shopify confirmation. */
  const notifyOrderCompleteIfThankYou = useCallback(
    (targetUrl: string) => {
      if (completedRef.current || !onOrderComplete || !isCheckoutThankYouUrl(targetUrl)) {
        return;
      }
      completedRef.current = true;
      logCheckout('orderComplete', { url: targetUrl });
      onOrderComplete();
    },
    [onOrderComplete],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const targetUrl = request.url;
      logUrl('shouldStartLoad', targetUrl);

      if (isWebViewSubresourceUrl(targetUrl)) return true;

      notifyOrderCompleteIfThankYou(targetUrl);

      if (redirectToLoginIfNeeded(targetUrl)) return false;

      /** After purchase, stay on Shopify confirmation — don't bounce to native home/cart. */
      if (completedRef.current) return true;

      if (shouldRedirectCheckoutToAppCart(targetUrl)) {
        if (!cartRedirectRef.current) {
          cartRedirectRef.current = true;
          logCheckout('redirect', { to: 'app-cart', url: targetUrl });
          onNavigateToCart();
        }
        return false;
      }

      if (shouldRedirectCheckoutToAppHome(targetUrl)) {
        if (!homeRedirectRef.current) {
          homeRedirectRef.current = true;
          logCheckout('redirect', { to: 'app-home', url: targetUrl });
          onNavigateToHome();
        }
        return false;
      }

      return true;
    },
    [logUrl, notifyOrderCompleteIfThankYou, redirectToLoginIfNeeded, onNavigateToCart, onNavigateToHome],
  );

  const handleNavigation = useCallback(
    (nav: { url: string; loading?: boolean; canGoBack?: boolean }) => {
      currentUrlRef.current = nav.url;
      logUrl('navigationStateChange', nav.url, {
        loading: nav.loading,
        canGoBack: nav.canGoBack,
      });

      notifyOrderCompleteIfThankYou(nav.url);

      if (completedRef.current) return;

      redirectToLoginIfNeeded(nav.url);
    },
    [logUrl, notifyOrderCompleteIfThankYou, redirectToLoginIfNeeded],
  );

  return (
    <View style={styles.root}>
      <WebViewComponent
        source={{ uri: url }}
        onLoadStart={() => {
          logUrl('loadStart', currentUrlRef.current);
          setLoading(true);
        }}
        onLoadEnd={() => {
          logUrl('loadEnd', currentUrlRef.current);
          setLoading(false);
        }}
        onNavigationStateChange={handleNavigation}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onError={(event) => {
          const native = event.nativeEvent;
          logCheckout('error', { ...native });
          reportOperationalFailure(native.description?.trim() || 'Checkout WebView load error', {
            source: 'checkout_webview',
            kind: 'webview_error',
            code: native.code ?? null,
            url: native.url ?? currentUrlRef.current,
          });
          setLoading(false);
        }}
        onHttpError={(event) => {
          const native = event.nativeEvent;
          logCheckout('httpError', { ...native });
          reportOperationalFailure(
            `Checkout WebView HTTP ${native.statusCode ?? 'error'}`,
            {
              source: 'checkout_webview',
              kind: 'webview_http_error',
              statusCode: native.statusCode ?? null,
              description: native.description ?? null,
              url: native.url ?? currentUrlRef.current,
            },
          );
          setLoading(false);
        }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        style={styles.webview}
      />
      {loading ? (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator color={palette.ink} />
        </View>
      ) : null}
    </View>
  );
}

export function CheckoutWebView({
  url,
  isAppLoggedIn,
  onOrderComplete,
  onNavigateToCart,
  onNavigateToHome,
  onNavigateToLogin,
}: Props) {
  const WebViewComponent = useMemo(() => loadNativeWebView(), []);

  if (!WebViewComponent) {
    return <CheckoutWebViewFallback url={url} />;
  }

  return (
    <CheckoutWebViewNative
      url={url}
      isAppLoggedIn={isAppLoggedIn}
      onOrderComplete={onOrderComplete}
      onNavigateToCart={onNavigateToCart}
      onNavigateToHome={onNavigateToHome}
      onNavigateToLogin={onNavigateToLogin}
      WebViewComponent={WebViewComponent}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  webview: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 247, 245, 0.72)',
  },
});
