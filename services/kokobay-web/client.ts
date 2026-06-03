import { KOKOBAY_PRODUCTS_API_KEY_HEADER } from '@/constants/kokobay-web';
import { patchAndroidEmulatorLocalhost } from '@/lib/dev-android-network';
import { getShopifyCountryCode, getShopifyCurrencyCode } from '@/services/shopify/market-context';
import { fetchWithTimeout, HttpResponseError } from '@/utils/fetch-with-timeout';

import { KokobayApiError, toKokobayApiError } from './api-errors';
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

/** `GET` JSON from the Koko Bay web API. Throws {@link KokobayApiError} on failure. */
export async function fetchKokobayJson(
  path: string,
  init?: { signal?: AbortSignal },
): Promise<Json> {
  const root = patchAndroidEmulatorLocalhost(resolveKokobayApiBaseUrl());
  if (!root) {
    throw new KokobayApiError('Koko Bay API is not configured');
  }
  const key = apiKey();
  const url = `${root}${withMarketQuery(path.startsWith('/') ? path : `/${path}`)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key) {
    headers[KOKOBAY_PRODUCTS_API_KEY_HEADER] = key;
  }

  try {
    const res = await fetchWithTimeout(url, { headers, signal: init?.signal });
    const text = await res.text();
    if (!res.ok) {
      throw new HttpResponseError(
        `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        res.status,
        url,
      );
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed === null || typeof parsed !== 'object') {
        throw new KokobayApiError('Invalid JSON response');
      }
      if (Array.isArray(parsed)) {
        return parsed as unknown as Json;
      }
      return parsed as Json;
    } catch (error) {
      if (error instanceof KokobayApiError) throw error;
      throw new KokobayApiError('Invalid JSON response', error);
    }
  } catch (error) {
    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[KOKOBAY API] fetch failed', { url, message });
    }
    throw toKokobayApiError(error);
  }
}

/** Same as {@link fetchKokobayJson} but returns `null` on failure (banners, optional CMS). */
export async function tryFetchKokobayJson(
  path: string,
  init?: { signal?: AbortSignal },
): Promise<Json | null> {
  try {
    return await fetchKokobayJson(path, init);
  } catch {
    return null;
  }
}

/** `GET /api/collections` → `{ collections: KokobayCollectionJson[] }` */
export async function fetchKokobayCollectionsJson(): Promise<Json | null> {
  return tryFetchKokobayJson('/api/collections');
}

export { KokobayApiError } from './api-errors';
