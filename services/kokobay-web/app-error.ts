import { isKokobayApiConfigured, resolveKokobayApiBaseUrl } from './api-config';

export type AppErrorBannerPayload = {
  active: boolean;
  message: string;
};

/** `GET /api/app-error` — Shopify `app_error` metaobject (not app_content). */
export async function fetchAppErrorBanner(
  init?: { signal?: AbortSignal },
): Promise<AppErrorBannerPayload | null> {
  const root = resolveKokobayApiBaseUrl();
  if (!root || !isKokobayApiConfigured()) return null;

  const url = `${root}/api/app-error`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: init?.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      if (__DEV__) {
        console.log('[AppErrorBanner] fetch miss', { status: res.status, url, apiBase: root });
      }
      return null;
    }
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
    const active = json.active === true;
    const message = typeof json.message === 'string' ? json.message.trim() : '';
    if (!active || !message) return null;
    return { active: true, message };
  } catch {
    if (init?.signal?.aborted) return null;
    return null;
  }
}
