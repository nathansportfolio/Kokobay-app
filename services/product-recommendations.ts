import { fetchKokobayProductRecommendations } from '@/services/kokobay-web/recommendations';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import type { Product } from '@/types/shopify';

export type ProductRecommendationIntent = 'related' | 'complementary';

type Options = {
  intent?: ProductRecommendationIntent;
  limit?: number;
};

/**
 * PDP / cart upsell recommendations from Koko Bay `/api/recommendations`.
 * Returns an empty list when the API is unavailable or has no matches.
 */
export async function getProductRecommendations(
  product: Product,
  options: Options = {},
): Promise<Product[]> {
  const limit = options.limit ?? 8;
  const intent = options.intent ?? 'related';
  const excludeHandle = product.handle;

  if (!isKokobayWebProductsConfigured()) {
    return [];
  }

  const fromApi = await fetchKokobayProductRecommendations({
    handle: product.handle,
    productId: product.id,
    intent,
    limit,
  });
  if (!fromApi?.length) {
    return [];
  }

  const result = fromApi.filter((p) => p.handle !== excludeHandle).slice(0, limit);
  return result;
}
