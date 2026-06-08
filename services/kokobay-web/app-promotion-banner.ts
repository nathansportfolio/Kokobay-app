import { legacyApiGetOptional } from '@/src/core/api';

import { isKokobayApiConfigured, kokobayApiEnvDebug } from './api-config';
import { getShopifyCountryCode } from '@/services/shopify/market-context';

export type AppPromotionBannerPayload = {
  active: boolean;
  message: string;
};

/** `GET /api/app-promotion-banner?country=GB` — Shopify `app_promotion_banner` metaobject. */
export async function fetchAppPromotionBanner(
  countryCode?: string,
  init?: { signal?: AbortSignal },
): Promise<AppPromotionBannerPayload | null> {
  if (!isKokobayApiConfigured()) {
    if (__DEV__) {
      console.log('[PROMOTION_BANNER]', { visible: false, reason: 'api_not_configured' });
    }
    return null;
  }

  const country = (countryCode?.trim() || getShopifyCountryCode()).toUpperCase();
  const path = `/api/app-promotion-banner?${new URLSearchParams({ country }).toString()}`;

  const json = await legacyApiGetOptional(path, {
    auth: 'none',
    marketQuery: false,
    signal: init?.signal,
    retries: 0,
    coalesce: false,
  });

  if (init?.signal?.aborted) {
    if (__DEV__) {
      console.log('[PROMOTION_BANNER]', { country, visible: false, reason: 'aborted' });
    }
    return null;
  }

  if (!json) {
    if (__DEV__) {
      console.log('[PROMOTION_BANNER]', {
        country,
        baseUrl: kokobayApiEnvDebug().baseUrl,
        path,
        visible: false,
        reason: 'no_response',
      });
    }
    return null;
  }

  const rawActive = json.active === true;
  const message = typeof json.message === 'string' ? json.message.trim() : '';
  const visible = rawActive && Boolean(message);

  if (__DEV__) {
    console.log('[PROMOTION_BANNER]', {
      country,
      baseUrl: kokobayApiEnvDebug().baseUrl,
      path,
      rawActive,
      rawMessage: json.message ?? null,
      rawError: typeof json.error === 'string' ? json.error : null,
      visible,
      message: message || null,
    });
  }

  if (!rawActive) return null;
  if (!message) return null;
  return { active: true, message };
}
