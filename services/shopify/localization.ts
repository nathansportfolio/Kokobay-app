import { fetchShopify, isShopifyConfigured } from './client';
import { GET_LOCALIZATION } from './queries';
import { isKokobayWebProductsConfigured, tryFetchKokobayJson } from '@/services/kokobay-web/client';
import {
  compareMarketOptionsByDisplayOrder,
  marketOptionDisplayLabel,
  premiumRegionNameForMarket,
} from '@/utils/market-option-label';

export type MarketOption = {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencyName: string;
  label: string;
};

type LocalizationCountry = {
  isoCode: string;
  name: string;
  currency?: {
    isoCode: string;
    name?: string | null;
    symbol?: string | null;
  } | null;
};

type LocalizationData = {
  localization?: {
    country?: LocalizationCountry | null;
    availableCountries?: LocalizationCountry[] | null;
  } | null;
};

const PREFERRED_COUNTRY_BY_CURRENCY: Record<string, string> = {
  GBP: 'GB',
  USD: 'US',
  EUR: 'IE',
  AUD: 'AU',
  CAD: 'CA',
  NZD: 'NZ',
};

const FALLBACK_MARKET_OPTIONS: MarketOption[] = [
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    currencyCode: 'GBP',
    currencyName: 'British Pound',
    label: 'United Kingdom (GBP)',
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    currencyCode: 'USD',
    currencyName: 'US Dollar',
    label: 'United States (USD)',
  },
  {
    countryCode: 'IE',
    countryName: 'Europe',
    currencyCode: 'EUR',
    currencyName: 'Euro',
    label: 'Europe (EUR)',
  },
];

function finalizeMarketOption(option: MarketOption): MarketOption {
  const countryName = premiumRegionNameForMarket(option);
  return {
    ...option,
    countryName,
    label: marketOptionDisplayLabel({ ...option, countryName }),
  };
}

export function marketOptionsFromCountries(countries: LocalizationCountry[]): MarketOption[] {
  const byCurrency = new Map<string, MarketOption>();

  for (const country of countries) {
    const countryCode = country.isoCode?.trim().toUpperCase();
    const currencyCode = country.currency?.isoCode?.trim().toUpperCase();
    if (!countryCode || !currencyCode) continue;

    const option = finalizeMarketOption({
      countryCode,
      countryName: country.name?.trim() || countryCode,
      currencyCode,
      currencyName: country.currency?.name?.trim() || currencyCode,
      label: '',
    });

    const preferred = PREFERRED_COUNTRY_BY_CURRENCY[currencyCode];
    const existing = byCurrency.get(currencyCode);
    if (!existing || countryCode === preferred) {
      byCurrency.set(currencyCode, option);
    }
  }

  return [...byCurrency.values()].sort(compareMarketOptionsByDisplayOrder);
}

export async function fetchShopifyMarketOptions(): Promise<MarketOption[]> {
  if (isKokobayWebProductsConfigured()) {
    const data = await tryFetchKokobayJson('/api/markets');
    const markets = data?.markets;
    if (Array.isArray(markets) && markets.length) {
      return markets
        .map((row) => {
          if (typeof row !== 'object' || row === null) return null;
          const o = row as Record<string, unknown>;
          const countryCode = String(o.countryCode ?? '').trim().toUpperCase();
          const currencyCode = String(o.currencyCode ?? '').trim().toUpperCase();
          if (!countryCode || !currencyCode) return null;
          return finalizeMarketOption({
            countryCode,
            countryName: String(o.countryName ?? countryCode),
            currencyCode,
            currencyName: String(o.currencyName ?? currencyCode),
            label: String(o.label ?? ''),
          });
        })
        .filter((row): row is MarketOption => row !== null)
        .sort(compareMarketOptionsByDisplayOrder);
    }
  }

  if (!isShopifyConfigured()) {
    return FALLBACK_MARKET_OPTIONS;
  }

  const data = await fetchShopify<LocalizationData>(GET_LOCALIZATION);
  const countries = data?.localization?.availableCountries ?? [];
  const options = marketOptionsFromCountries(countries);
  return options.length ? options : FALLBACK_MARKET_OPTIONS;
}
