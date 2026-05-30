import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useEffect } from 'react';

import { AppGlobalShell } from '@/components/providers/app-global-shell';
import { AppErrorRouteTracker } from '@/components/providers/app-error-route-tracker';
import { GtmRouteTracker } from '@/components/providers/gtm-route-tracker';
import { ScrollToTopProvider } from '@/contexts/scroll-to-top-context';
import { BagProvider } from '@/contexts/bag-context';
import { WishlistProvider } from '@/contexts/wishlist-context';
import { getQueryClient } from '@/hooks/use-query-client';
import { registerAppErrorUserIdReader } from '@/lib/app-error-context';
import { registerCartCustomerEmailReader } from '@/services/kokobay-web/cart-customer';
import { registerCustomerSessionReader } from '@/services/kokobay-web/customer-session-reader';
import { LOCALE_CURRENCY_TOAST } from '@/services/shopify/initialize-currency-from-locale';
import { useAuthStore, useCartStore, useMarketStore, useSearchHistoryStore, showToast } from '@/store';

registerCartCustomerEmailReader(() => useAuthStore.getState().user?.email);
registerCustomerSessionReader(() => useAuthStore.getState().accessToken ?? undefined);
registerAppErrorUserIdReader(() => useAuthStore.getState().user?.id ?? useAuthStore.getState().user?.email);

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    void (async () => {
      await useMarketStore.getState().hydrate();
      await useAuthStore.getState().hydrate();
      await useCartStore.getState().hydrate();
      await useSearchHistoryStore.getState().hydrate();

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
      <GtmRouteTracker />
      <WishlistProvider>
        <BagProvider>
          <ScrollToTopProvider>
            <AppGlobalShell>{children}</AppGlobalShell>
          </ScrollToTopProvider>
        </BagProvider>
      </WishlistProvider>
    </QueryClientProvider>
  );
}
