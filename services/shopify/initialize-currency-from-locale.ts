import { NativeModules, Platform } from 'react-native';

import { readFromSecureStore, writeToSecureStore } from '@/services/storage/secureStore';
import { loadMarketPreference, persistMarketPreference } from '@/store/market-persist';

export const CURRENCY_INITIALIZED_KEY = 'currencyInitialized';
export const SELECTED_CURRENCY_KEY = 'selectedCurrency';

export type LocaleDetectedCurrency = 'USD' | 'EUR' | 'GBP';

const EUR_REGIONS = new Set([
  'FR',
  'DE',
  'ES',
  'IT',
  'NL',
  'BE',
  'AT',
  'PT',
  'IE',
  'LU',
  'FI',
  'GR',
]);

export const LOCALE_CURRENCY_TOAST: Record<LocaleDetectedCurrency, string> = {
  GBP: 'Prices are being shown in GBP (£). You can change this anytime in Settings.',
  USD: 'Prices are being shown in USD ($). You can change this anytime in Settings.',
  EUR: 'Prices are being shown in EUR (€). You can change this anytime in Settings.',
};

function isLocaleDetectedCurrency(value: string): value is LocaleDetectedCurrency {
  return value === 'USD' || value === 'EUR' || value === 'GBP';
}

export function currencyFromRegionCode(regionCode: string | null | undefined): LocaleDetectedCurrency {
  const region = regionCode?.trim().toUpperCase();
  if (region === 'US') return 'USD';
  if (region && EUR_REGIONS.has(region)) return 'EUR';
  return 'GBP';
}

/** Device region without `expo-localization` (avoids native module on dev client until rebuilt). */
export function getDeviceRegionCode(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const parts = locale.split(/[-_]/);
    if (parts.length >= 2) {
      const region = parts[parts.length - 1]?.trim().toUpperCase();
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    }
  } catch {
    // Intl unavailable — try platform fallbacks below.
  }

  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings as
      | { AppleLocale?: string; AppleLanguages?: string[] }
      | undefined;
    const raw = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
    const match = raw?.match(/[-_]([A-Za-z]{2})\b/);
    if (match?.[1]) return match[1].toUpperCase();
  }

  if (Platform.OS === 'android') {
    const raw = NativeModules.I18nManager?.localeIdentifier as string | undefined;
    const match = raw?.match(/[-_]([A-Za-z]{2})\b/);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return null;
}

export function countryCodeForLocaleCurrency(
  currency: LocaleDetectedCurrency,
  regionCode: string | null | undefined,
): string {
  if (currency === 'USD') return 'US';
  if (currency === 'GBP') return 'GB';

  const region = regionCode?.trim().toUpperCase();
  if (region && EUR_REGIONS.has(region)) return region;
  return 'IE';
}

export type InitializeCurrencyFromLocaleResult = {
  didInitialize: boolean;
  currency: LocaleDetectedCurrency | null;
};

/**
 * Detects locale currency on first launch only. Idempotent after `currencyInitialized` is set
 * or when a market preference already exists (manual selection / upgrade path).
 */
export async function initializeCurrencyFromLocale(): Promise<InitializeCurrencyFromLocaleResult> {
  const initialized = await readFromSecureStore(CURRENCY_INITIALIZED_KEY);
  if (initialized === 'true') {
    return { didInitialize: false, currency: null };
  }

  const existing = await loadMarketPreference();
  if (existing) {
    const currency = existing.currencyCode.trim().toUpperCase();
    await writeToSecureStore(
      SELECTED_CURRENCY_KEY,
      isLocaleDetectedCurrency(currency) ? currency : 'GBP',
    );
    await writeToSecureStore(CURRENCY_INITIALIZED_KEY, 'true');
    return { didInitialize: false, currency: null };
  }

  const regionCode = getDeviceRegionCode();
  const currency = currencyFromRegionCode(regionCode);
  const countryCode = countryCodeForLocaleCurrency(currency, regionCode);

  await persistMarketPreference({ countryCode, currencyCode: currency });
  await writeToSecureStore(SELECTED_CURRENCY_KEY, currency);
  await writeToSecureStore(CURRENCY_INITIALIZED_KEY, 'true');

  return { didInitialize: true, currency };
}
