/** Default Shopify market when no preference is saved. */
export const DEFAULT_MARKET_COUNTRY = 'GB';
export const DEFAULT_MARKET_CURRENCY = 'GBP';

/** Avoid market ↔ API circular imports — registered once at app startup. */
let readCountryCode: (() => string) | null = null;
let readCurrencyCode: (() => string) | null = null;

export function registerMarketCountryReader(fn: () => string): void {
  readCountryCode = fn;
}

export function registerMarketCurrencyReader(fn: () => string): void {
  readCurrencyCode = fn;
}

export function getShopifyCountryCode(): string {
  const code = readCountryCode?.()?.trim().toUpperCase();
  return code || DEFAULT_MARKET_COUNTRY;
}

export function getShopifyCurrencyCode(): string {
  const code = readCurrencyCode?.()?.trim().toUpperCase();
  return code || DEFAULT_MARKET_CURRENCY;
}
