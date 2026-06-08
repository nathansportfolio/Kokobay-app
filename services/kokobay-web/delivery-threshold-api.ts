import { legacyApiGetOptional } from '@/src/core/api';

import { isKokobayApiConfigured } from './api-config';

/** `GET /api/delivery-threshold` — Shopify `delivery_threshold` metaobject (not app_content). */
export async function fetchDeliveryThresholdFromApi(
  init?: { signal?: AbortSignal },
): Promise<number | null> {
  if (!isKokobayApiConfigured()) return null;

  const json = await legacyApiGetOptional('/api/delivery-threshold', {
    auth: 'none',
    marketQuery: false,
    signal: init?.signal,
    retries: 0,
    coalesce: false,
  });

  if (init?.signal?.aborted || !json) return null;

  const n = typeof json.thresholdGbp === 'number' ? json.thresholdGbp : Number(json.thresholdGbp);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}
