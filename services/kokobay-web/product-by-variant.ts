import { shopifyVariantKey } from '@/utils/shopify-variant-key';

import { tryFetchKokobayJson } from './client';

/** Resolve a Shopify variant id (numeric or GID) to its parent product handle. */
export async function fetchProductHandleByVariantId(
  variantId: string,
  init?: { signal?: AbortSignal },
): Promise<string | null> {
  const key = shopifyVariantKey(variantId);
  if (!/^\d+$/.test(key)) return null;

  const data = await tryFetchKokobayJson(
    `/api/products/by-variant/${encodeURIComponent(key)}`,
    init,
  );
  const handle = typeof data?.handle === 'string' ? data.handle.trim() : '';
  return handle || null;
}
