import { Image } from 'expo-image';

import type { ProductCardPreviewImage } from '@/utils/product-card-preview-images';
import { productTileImageUri } from '@/utils/product-tile-image-uri';
import { shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';

const MAX_TILE_PREVIEW_IMAGES = 3;

/** Warm expo-image disk/memory cache for product tile images 2–3 (index 0 is already mounted). */
export function prefetchProductCardSecondaryImages(
  images: ProductCardPreviewImage[],
  options?: { tileWidth?: number; handle?: string },
): void {
  for (const img of images.slice(1, MAX_TILE_PREVIEW_IMAGES)) {
    const uri = productTileImageUri({
      url: img.url,
      width: img.width,
      height: img.height,
      tileWidth: options?.tileWidth,
      handle: options?.handle,
    });

    const resolved = shopifyCdnUriForPlatform(uri.trim());
    if (!resolved) continue;
    void Image.prefetch(resolved);
  }
}
