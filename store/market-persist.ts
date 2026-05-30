import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'kokobay_market_v1';

export type PersistedMarketPreference = {
  countryCode: string;
  currencyCode: string;
};

function isPersistedMarketPreference(value: unknown): value is PersistedMarketPreference {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.countryCode === 'string' &&
    o.countryCode.length >= 2 &&
    typeof o.currencyCode === 'string' &&
    o.currencyCode.length >= 3
  );
}

export async function loadMarketPreference(): Promise<PersistedMarketPreference | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPersistedMarketPreference(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function persistMarketPreference(pref: PersistedMarketPreference): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    /* persist best-effort */
  }
}
