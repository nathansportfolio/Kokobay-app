import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren } from 'react';

import { CheckoutUnavailableModal } from '@/components/checkout/checkout-unavailable-modal';
import { AppUpdateGate } from '@/components/update/app-update-gate';
import { AppGlobalShell } from '@/components/providers/app-global-shell';
import { AppErrorBannerSync } from '@/components/providers/app-error-banner-sync';
import { AppHomeHeroSync } from '@/components/providers/app-home-hero-sync';
import { AppPromotionBannerSync } from '@/components/providers/app-promotion-banner-sync';
import { DeliveryThresholdSync } from '@/components/providers/delivery-threshold-sync';
import { ForegroundAuditSync } from '@/components/providers/foreground-audit-sync';
import { JsFreezeAuditSync } from '@/components/providers/js-freeze-audit-sync';
import { RenderTraceSync } from '@/components/providers/render-trace-sync';
import { LifecyclePerfSync } from '@/components/providers/lifecycle-perf-sync';
import { ResumePerfSync } from '@/components/providers/resume-perf-sync';
import { AppErrorRouteTracker } from '@/components/providers/app-error-route-tracker';
import { GtmRouteTracker } from '@/components/providers/gtm-route-tracker';
import { ScrollToTopProvider } from '@/contexts/scroll-to-top-context';
import { BagProvider } from '@/contexts/bag-context';
import { WishlistProvider } from '@/contexts/wishlist-context';
import { getQueryClient } from '@/hooks/use-query-client';
import { registerAppErrorUserIdReader } from '@/lib/app-error-context';
import { registerCartCustomerEmailReader, registerCartCustomerUserIdReader } from '@/services/kokobay-web/cart-customer';
import { registerCustomerSessionReader } from '@/services/kokobay-web/customer-session-reader';
import { startAuthEngine } from '@/src/core/auth/auth-engine';
import { startCartEngine } from '@/src/core/cart';
import { getAuthAccessToken } from '@/src/core/auth/token';
import { startPushEngine } from '@/src/core/push';
import { useAuthStore } from '@/store';

registerCartCustomerEmailReader(() => useAuthStore.getState().user?.email);
registerCartCustomerUserIdReader(() => useAuthStore.getState().user?.id);
registerCustomerSessionReader(() => getAuthAccessToken());
registerAppErrorUserIdReader(() => useAuthStore.getState().user?.id ?? useAuthStore.getState().user?.email);

startAuthEngine(useAuthStore);
startCartEngine();
startPushEngine(useAuthStore);

export function AppProviders({ children }: PropsWithChildren) {
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
      <AppHomeHeroSync />
      <AppErrorBannerSync />
      <GtmRouteTracker />
      <WishlistProvider>
        <BagProvider>
          <ScrollToTopProvider>
            <AppGlobalShell>{children}</AppGlobalShell>
            <CheckoutUnavailableModal />
            <AppUpdateGate />
          </ScrollToTopProvider>
        </BagProvider>
      </WishlistProvider>
    </QueryClientProvider>
  );
}
