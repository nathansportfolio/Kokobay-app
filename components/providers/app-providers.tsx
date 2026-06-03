import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useEffect } from 'react';

import { CheckoutUnavailableModal } from '@/components/checkout/checkout-unavailable-modal';
import { AppGlobalShell } from '@/components/providers/app-global-shell';
import { AppErrorBannerSync } from '@/components/providers/app-error-banner-sync';
import { AppPromotionBannerSync } from '@/components/providers/app-promotion-banner-sync';
import { DeliveryThresholdSync } from '@/components/providers/delivery-threshold-sync';
import { ForegroundAuditSync } from '@/components/providers/foreground-audit-sync';
import { JsFreezeAuditSync } from '@/components/providers/js-freeze-audit-sync';
import { RenderTraceSync } from '@/components/providers/render-trace-sync';
import { LifecyclePerfSync } from '@/components/providers/lifecycle-perf-sync';
import { ResumePerfSync } from '@/components/providers/resume-perf-sync';
import { AppErrorRouteTracker } from '@/components/providers/app-error-route-tracker';
import { GtmRouteTracker } from '@/components/providers/gtm-route-tracker';
import { KlaviyoSync } from '@/components/providers/klaviyo-sync';
import { ScrollToTopProvider } from '@/contexts/scroll-to-top-context';
import { BagProvider } from '@/contexts/bag-context';
import { WishlistProvider } from '@/contexts/wishlist-context';
import { getQueryClient } from '@/hooks/use-query-client';
import { registerAppErrorUserIdReader } from '@/lib/app-error-context';
import {
  initializeFirebaseCrashlytics,
  setFirebaseCrashlyticsUserId,
} from '@/src/lib/firebase-crashlytics';
import { initializeFirebaseAnalytics } from '@/src/lib/firebase';
import { probeKlaviyoOnAppStart } from '@/lib/klaviyo/client';
import { registerCartCustomerEmailReader } from '@/services/kokobay-web/cart-customer';
import { registerCustomerSessionReader } from '@/services/kokobay-web/customer-session-reader';
import { LOCALE_CURRENCY_TOAST } from '@/services/shopify/initialize-currency-from-locale';
import { useAuthStore, useCartStore, useMarketStore, useSearchHistoryStore, showToast } from '@/store';

registerCartCustomerEmailReader(() => useAuthStore.getState().user?.email);
registerCustomerSessionReader(() => useAuthStore.getState().accessToken ?? undefined);
registerAppErrorUserIdReader(() => useAuthStore.getState().user?.id ?? useAuthStore.getState().user?.email);

if (__DEV__) {
  probeKlaviyoOnAppStart();
}

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    void initializeFirebaseAnalytics();
    void initializeFirebaseCrashlytics();
    probeKlaviyoOnAppStart();
  }, []);

  useEffect(() => {
    const syncCrashlyticsUser = () => {
      const user = useAuthStore.getState().user;
      void setFirebaseCrashlyticsUserId(user?.id ?? user?.email);
    };

    syncCrashlyticsUser();
    return useAuthStore.subscribe(syncCrashlyticsUser);
  }, []);

  useEffect(() => {
    void (async () => {
      await useMarketStore.getState().hydrate();
      if (__DEV__) console.log('[CART_STATE_TRANSITION] source=app_hydrate:market_done');
      await Promise.all([
        useAuthStore.getState().hydrate(),
        useSearchHistoryStore.getState().hydrate(),
      ]);
      if (__DEV__) console.log('[CART_STATE_TRANSITION] source=app_hydrate:auth_done');
      await useCartStore.getState().hydrate();
      if (__DEV__) console.log('[CART_STATE_TRANSITION] source=app_hydrate:cart_done');

      const pendingCurrencyToast = useMarketStore.getState().pendingLocaleCurrencyToast;
      if (pendingCurrencyToast) {
        showToast({ variant: 'info', title: LOCALE_CURRENCY_TOAST[pendingCurrencyToast] });
        useMarketStore.getState().clearPendingLocaleCurrencyToast();
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={getQueryClient()}>
      <AppErrorRouteTracker />
      <LifecyclePerfSync />
      <ResumePerfSync />
      <ForegroundAuditSync />
      <JsFreezeAuditSync />
      <DeliveryThresholdSync />
      <RenderTraceSync />
      <AppPromotionBannerSync />
      <AppErrorBannerSync />
      <GtmRouteTracker />
      <KlaviyoSync />
      <WishlistProvider>
        <BagProvider>
          <ScrollToTopProvider>
            <AppGlobalShell>{children}</AppGlobalShell>
            <CheckoutUnavailableModal />
          </ScrollToTopProvider>
        </BagProvider>
      </WishlistProvider>
    </QueryClientProvider>
  );
}
