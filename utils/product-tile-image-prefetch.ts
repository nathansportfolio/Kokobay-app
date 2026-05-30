import { Image } from 'expo-image';

import type { Product } from '@/types/shopify';
import { firstValidProductImage } from '@/utils/catalog-image';
import { productTileImageUri } from '@/utils/product-tile-image-uri';
import { shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';

/** Warm expo-image disk/memory cache for product tile URLs (rails, related products). */
export function prefetchProductTileImages(
  products: Product[],
  options?: { tileWidth?: number; limit?: number },
): void {
  const slice = products.slice(0, options?.limit ?? products.length);

  for (const product of slice) {
    const sourceImage = firstValidProductImage(product);
    if (!sourceImage) continue;

    const uri = productTileImageUri({
      url: sourceImage.url,
      width: sourceImage.width,
      height: sourceImage.height,
      tileWidth: options?.tileWidth,
      handle: product.handle,
    });

    const resolved = shopifyCdnUriForPlatform(uri.trim());
    if (!resolved) continue;
    void Image.prefetch(resolved);
  }
}
