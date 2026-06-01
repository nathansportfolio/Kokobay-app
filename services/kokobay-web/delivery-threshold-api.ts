import { isKokobayApiConfigured, resolveKokobayApiBaseUrl } from './api-config';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

/** `GET /api/delivery-threshold` — Shopify `delivery_threshold` metaobject (not app_content). */
export async function fetchDeliveryThresholdFromApi(
  init?: { signal?: AbortSignal },
): Promise<number | null> {
  const root = resolveKokobayApiBaseUrl();
  if (!root || !isKokobayApiConfigured()) return null;

  const url = `${root}/api/delivery-threshold`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: init?.signal,
    });
    const text = await res.text();
    if (!res.ok) return null;
    const json = JSON.parse(text) as { thresholdGbp?: unknown };
    const n = typeof json.thresholdGbp === 'number' ? json.thresholdGbp : Number(json.thresholdGbp);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  } catch {
    if (init?.signal?.aborted) return null;
    return null;
  }
}
