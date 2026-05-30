import { KOKOBAY_PRODUCTS_API_KEY_HEADER } from '@/constants/kokobay-web';
import { getShopifyCountryCode, getShopifyCurrencyCode } from '@/services/shopify/market-context';

import {
  isKokobayApiConfigured,
  kokobayApiEnvDebug,
  resolveKokobayApiBaseUrl,
} from './api-config';

function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_KOKOBAY_PRODUCTS_API_KEY?.trim();
}

/** True when a Koko Bay API base URL resolves (production or local target). */
export function isKokobayWebProductsConfigured(): boolean {
  return isKokobayApiConfigured();
}

/** @deprecated Use {@link kokobayApiEnvDebug} from `./api-config`. */
export function kokobayWebEnvDebug(): ReturnType<typeof kokobayApiEnvDebug> {
  return kokobayApiEnvDebug();
}

type Json = Record<string, unknown>;

function withMarketQuery(path: string): string {
  const country = getShopifyCountryCode();
  const currency = getShopifyCurrencyCode();
  if (!country && !currency) return path;
  const sep = path.includes('?') ? '&' : '?';
  const params = new URLSearchParams();
  if (country) {
    params.set('country', country);
    params.set('countryCode', country);
  }
  if (currency) {
    params.set('currency', currency);
    params.set('currencyCode', currency);
  }
  return `${path}${sep}${params.toString()}`;
}

/** `GET` JSON from the Koko Bay web API (public storefront routes). */
export async function fetchKokobayJson(
  path: string,
  init?: { signal?: AbortSignal },
): Promise<Json | null> {
  const root = resolveKokobayApiBaseUrl();
  if (!root) {
    return null;
  }
  const key = apiKey();
  const url = `${root}${withMarketQuery(path.startsWith('/') ? path : `/${path}`)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key) {
    headers[KOKOBAY_PRODUCTS_API_KEY_HEADER] = key;
  }
  try {
    const res = await fetch(url, { headers, signal: init?.signal });
    const text = await res.text();
    if (!res.ok) {
      return null;
    }
    try {
      return JSON.parse(text) as Json;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/** `GET /api/collections` → `{ collections: KokobayCollectionJson[] }` */
export async function fetchKokobayCollectionsJson(): Promise<Json | null> {
  return fetchKokobayJson('/api/collections');
}
