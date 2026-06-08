import { APP_CART_DELIVERY_TEXT_CONTENT_SLUG } from '@/constants/app-cart-delivery-text-cms';
import { buildCmsCountryContentSlug } from '@/utils/cms-country-content-slug';
import { getShopifyCountryCode } from '@/services/shopify/market-context';

import { legacyApiGetOptional } from '@/src/core/api';

import { isKokobayApiConfigured } from './api-config';

export type AppCartDeliveryTextPayload = {
  handle: string;
  text: string;
};

function normalizePayload(json: Record<string, unknown>): AppCartDeliveryTextPayload | null {
  const text =
    (typeof json.text === 'string' ? json.text : typeof json.content === 'string' ? json.content : '')
      .trim();
  if (!text) return null;

  return {
    handle: typeof json.handle === 'string' ? json.handle.trim() : '',
    text,
  };
}

/** `GET /api/content/app-cart-delivery-text-gb` — Shopify `app_cart_delivery_text` metaobject. */
export async function fetchAppCartDeliveryText(
  countryCode?: string,
  init?: { signal?: AbortSignal },
): Promise<AppCartDeliveryTextPayload | null> {
  if (!isKokobayApiConfigured()) return null;

  const country = (countryCode?.trim() || getShopifyCountryCode()).toUpperCase();
  const slug = buildCmsCountryContentSlug(APP_CART_DELIVERY_TEXT_CONTENT_SLUG, country);
  const path = `/api/content/${encodeURIComponent(slug)}`;

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
