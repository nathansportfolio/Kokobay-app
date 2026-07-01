import { APP_HOME_HERO_CONTENT_SLUG } from '@/constants/app-home-hero-cms';
import { getShopifyCountryCode } from '@/services/shopify/market-context';
import { normalizeHomeHeroButtonStyle, type HomeHeroButtonStyle } from '@/utils/home-hero-button-style';

import { legacyApiGetOptional } from '@/src/core/api';

import { isKokobayApiConfigured } from './api-config';

export type AppHomeHeroPayload = {
  handle: string;
  imageUrl: string;
  text: string;
  buttonText: string;
  buttonLink: string;
  textColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonStyle: HomeHeroButtonStyle;
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
    buttonStyle: normalizeHomeHeroButtonStyle(
      typeof json.buttonStyle === 'string' ? json.buttonStyle : undefined,
    ),
  };
}

/** `GET /api/content/app-home-hero?country=GB` — Shopify `app_home_hero` metaobject. */
export async function fetchAppHomeHero(
  countryCode?: string,
  init?: { signal?: AbortSignal },
): Promise<AppHomeHeroPayload | null> {
  if (!isKokobayApiConfigured()) return null;

  const country = (countryCode?.trim() || getShopifyCountryCode()).toUpperCase();
  const path = `/api/content/${encodeURIComponent(APP_HOME_HERO_CONTENT_SLUG)}?${new URLSearchParams({ country }).toString()}`;

  const json = await legacyApiGetOptional(path, {
    auth: 'none',
    marketQuery: false,
    signal: init?.signal,
    retries: 0,
    coalesce: false,
  });

  if (init?.signal?.aborted || !json) return null;
  return normalizePayload(json);
}
