import type { Product } from '@/types/shopify';

import { isKokobayWebProductsConfigured, tryFetchKokobayJson } from './client';
import { storefrontProductPreviewToProduct } from './storefront-mappers';
import type { KokobayRecommendationsJson } from './storefront-types';

export type ProductRecommendationIntent = 'related' | 'complementary';

const SLIM_RECOMMENDATIONS_MAX = 12;
const FULL_RECOMMENDATIONS_MAX = 10;

/**
 * Slim PDP feed: `GET /api/recommendations?handle=...&limit=8`
 * Full feed (intent): `GET /api/products/recommendations?handle=...&intent=complementary&limit=3`
 */
export async function fetchKokobayProductRecommendations(options: {
  handle?: string;
  productId?: string;
  intent?: ProductRecommendationIntent;
  limit?: number;
}): Promise<Product[] | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const handle = options.handle?.trim();
  const productId = options.productId?.trim();
  if (!handle && !productId) return null;

  const intent = options.intent ?? 'related';
  const limit = options.limit ?? 8;
  const useFullRoute = intent === 'complementary';
  const maxLimit = useFullRoute ? FULL_RECOMMENDATIONS_MAX : SLIM_RECOMMENDATIONS_MAX;

  const params = new URLSearchParams();
  if (handle) params.set('handle', handle);
  if (productId) params.set('productId', productId);
  if (useFullRoute) params.set('intent', intent);
  params.set('limit', String(Math.min(maxLimit, Math.max(1, limit))));

  const path = useFullRoute
    ? `/api/products/recommendations?${params.toString()}`
    : `/api/recommendations?${params.toString()}`;

  const data = await tryFetchKokobayJson(path);
  if (!data) {
    return null;
  }
  if (typeof data.error === 'string') {
    return null;
  }
  if (!Array.isArray(data.products)) {
    return null;
  }

  const body = data as unknown as KokobayRecommendationsJson;
  const mapped = body.products
    .map((p) => storefrontProductPreviewToProduct(p))
    .filter((p): p is Product => p !== null);

  if (!mapped.length) {
    return null;
  }

  return mapped;
}
