/** Premium region names for common storefront currencies. */
const PREMIUM_REGION_BY_CURRENCY: Record<string, string> = {
  GBP: 'United Kingdom',
  USD: 'United States',
  EUR: 'Europe',
  AUD: 'Australia',
  CAD: 'Canada',
  NZD: 'New Zealand',
};

/** Preferred row order in currency settings (UK → US → Europe first). */
export const MARKET_CURRENCY_DISPLAY_ORDER = ['GBP', 'USD', 'EUR', 'AUD', 'CAD', 'NZD'] as const;

type MarketLabelInput = {
  countryCode: string;
  countryName: string;
  currencyCode: string;
};

export function premiumRegionNameForMarket(option: MarketLabelInput): string {
  const currency = option.currencyCode.trim().toUpperCase();
  const mapped = PREMIUM_REGION_BY_CURRENCY[currency];
  if (mapped) return mapped;
  return option.countryName.trim() || option.countryCode.trim();
}

/** e.g. `United Kingdom (GBP)` */
export function marketOptionDisplayLabel(option: MarketLabelInput): string {
  const currency = option.currencyCode.trim().toUpperCase();
  return `${premiumRegionNameForMarket(option)} (${currency})`;
}

export function compareMarketOptionsByDisplayOrder(a: MarketLabelInput, b: MarketLabelInput): number {
  const order: readonly string[] = MARKET_CURRENCY_DISPLAY_ORDER;
  const ai = order.indexOf(a.currencyCode.trim().toUpperCase());
  const bi = order.indexOf(b.currencyCode.trim().toUpperCase());
  if (ai !== -1 && bi !== -1) return ai - bi;
  if (ai !== -1) return -1;
  if (bi !== -1) return 1;
  return a.currencyCode.localeCompare(b.currencyCode);
}
