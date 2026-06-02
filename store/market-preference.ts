import { create } from 'zustand';

import { getQueryClient } from '@/hooks/use-query-client';
import { recordHydration } from '@/lib/lifecycle-perf';
import {
  initializeCurrencyFromLocale,
  type LocaleDetectedCurrency,
  CURRENCY_INITIALIZED_KEY,
  SELECTED_CURRENCY_KEY,
} from '@/services/shopify/initialize-currency-from-locale';
import {
  DEFAULT_MARKET_COUNTRY,
  DEFAULT_MARKET_CURRENCY,
  registerMarketCountryReader,
  registerMarketCurrencyReader,
} from '@/services/shopify/market-context';
import { writeToSecureStore } from '@/services/storage/secureStore';
import { loadMarketPreference, persistMarketPreference } from '@/store/market-persist';
import { persistCartGuestId, persistShopifyCartId } from '@/store/cart-persist';
import { reloadDeliveryThresholdForMarketChange } from '@/services/delivery-threshold';
import { refreshAppData } from '@/utils/refresh-app-data';

import { flushCartSync, useCartStore } from './cart';

export type CurrencyCode = string;

export { DEFAULT_MARKET_COUNTRY, DEFAULT_MARKET_CURRENCY };

type MarketState = {
  countryCode: string;
  currencyCode: string;
  hasHydrated: boolean;
  pendingLocaleCurrencyToast: LocaleDetectedCurrency | null;
  hydrate: () => Promise<void>;
  setMarket: (countryCode: string, currencyCode: string) => Promise<void>;
  clearPendingLocaleCurrencyToast: () => void;
};

export const useMarketStore = create<MarketState>((set, get) => ({
  countryCode: DEFAULT_MARKET_COUNTRY,
  currencyCode: DEFAULT_MARKET_CURRENCY,
  hasHydrated: false,
  pendingLocaleCurrencyToast: null,
  hydrate: async () => {
    if (__DEV__) recordHydration('market', get().hasHydrated);
    if (get().hasHydrated) return;
    const init = await initializeCurrencyFromLocale();
    const saved = await loadMarketPreference();
    const updates: Partial<MarketState> = { hasHydrated: true };

    if (saved) {
      updates.countryCode = saved.countryCode.toUpperCase();
      updates.currencyCode = saved.currencyCode.toUpperCase();
    }

    if (init.didInitialize && init.currency) {
      updates.pendingLocaleCurrencyToast = init.currency;
    }

    set(updates);
  },
  clearPendingLocaleCurrencyToast: () => {
    set({ pendingLocaleCurrencyToast: null });
  },
  setMarket: async (countryCode, currencyCode) => {
    const nextCountry = countryCode.trim().toUpperCase();
    const nextCurrency = currencyCode.trim().toUpperCase();
    const prev = get();
    if (prev.countryCode === nextCountry && prev.currencyCode === nextCurrency) return;

    set({ countryCode: nextCountry, currencyCode: nextCurrency });
    await persistMarketPreference({ countryCode: nextCountry, currencyCode: nextCurrency });
    await writeToSecureStore(SELECTED_CURRENCY_KEY, nextCurrency);
    await writeToSecureStore(CURRENCY_INITIALIZED_KEY, 'true');
    await persistShopifyCartId(null);
    await persistCartGuestId(null);
    useCartStore.setState({ shopifyCartId: null, checkoutUrl: null });
    const queryClient = getQueryClient();
    await refreshAppData(queryClient);
    await reloadDeliveryThresholdForMarketChange();
    await queryClient.refetchQueries({ type: 'active' });
    void flushCartSync();
  },
}));

/** @deprecated Use `useMarketStore` — kept for existing imports. */
export const useLuxuryUiStore = create<{
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}>((set) => ({
  currency: DEFAULT_MARKET_CURRENCY,
  setCurrency: (currency) => set({ currency }),
}));

registerMarketCountryReader(() => useMarketStore.getState().countryCode);
registerMarketCurrencyReader(() => useMarketStore.getState().currencyCode);
