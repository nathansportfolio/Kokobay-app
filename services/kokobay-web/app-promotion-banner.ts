import { isKokobayApiConfigured, resolveKokobayApiBaseUrl } from './api-config';

export type AppPromotionBannerPayload = {
  active: boolean;
  message: string;
};

/** `GET /api/app-promotion-banner` — Shopify `app_promotion_banner` metaobject. */
export async function fetchAppPromotionBanner(
  init?: { signal?: AbortSignal },
): Promise<AppPromotionBannerPayload | null> {
  const root = resolveKokobayApiBaseUrl();
  if (!root || !isKokobayApiConfigured()) return null;

  const url = `${root}/api/app-promotion-banner`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: init?.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      if (__DEV__) {
        console.log('[AppPromotionBanner] fetch miss', { status: res.status, url, apiBase: root });
      }
      return null;
    }
    const json = JSON.parse(text) as { active?: unknown; message?: unknown };
    if (json.active !== true) return null;
    const message = typeof json.message === 'string' ? json.message.trim() : '';
    if (!message) return null;
    return { active: true, message };
  } catch {
    if (init?.signal?.aborted) return null;
    return null;
  }
}
