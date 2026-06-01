import { APP_HOME_HERO_CONTENT_SLUG } from '@/constants/app-home-hero-cms';
import { getShopifyCountryCode } from '@/services/shopify/market-context';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

import { isKokobayApiConfigured, resolveKokobayApiBaseUrl } from './api-config';

export type AppHomeHeroPayload = {
  handle: string;
  imageUrl: string;
  text: string;
  buttonText: string;
  buttonLink: string;
  textColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
};

function normalizePayload(json: Record<string, unknown>): AppHomeHeroPayload | null {
  const imageUrl = typeof json.imageUrl === 'string' ? json.imageUrl.trim() : '';
  if (!imageUrl) return null;

  return {
    handle: typeof json.handle === 'string' ? json.handle.trim() : '',
    imageUrl,
    text: typeof json.text === 'string' ? json.text.trim() : '',
    buttonText: typeof json.buttonText === 'string' ? json.buttonText.trim() : '',
    buttonLink: typeof json.buttonLink === 'string' ? json.buttonLink.trim() : '',
    textColor: typeof json.textColor === 'string' ? json.textColor.trim() : '',
    buttonBackgroundColor:
      typeof json.buttonBackgroundColor === 'string' ? json.buttonBackgroundColor.trim() : '',
    buttonTextColor:
      typeof json.buttonTextColor === 'string' ? json.buttonTextColor.trim() : '',
  };
}

/** `GET /api/content/app-home-hero?country=GB` — Shopify `app_home_hero` metaobject. */
export async function fetchAppHomeHero(
  countryCode?: string,
  init?: { signal?: AbortSignal },
): Promise<AppHomeHeroPayload | null> {
  const root = resolveKokobayApiBaseUrl();
  if (!root || !isKokobayApiConfigured()) return null;

  const country = (countryCode?.trim() || getShopifyCountryCode()).toUpperCase();
  const path = `/api/content/${encodeURIComponent(APP_HOME_HERO_CONTENT_SLUG)}`;
  const url = `${root}${path}?${new URLSearchParams({ country }).toString()}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: init?.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      if (__DEV__) {
        console.log('[AppHomeHero] fetch miss', { status: res.status, url, apiBase: root, country });
      }
      return null;
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }

    return normalizePayload(json);
  } catch {
    if (init?.signal?.aborted) return null;
    return null;
  }
}
