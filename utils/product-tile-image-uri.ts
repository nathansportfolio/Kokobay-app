import { PixelRatio } from 'react-native';

import { applyShopifyCdnImageParams, isShopifyCdnUrl } from '@/utils/shopify-cdn-image';

/** Delivery width cap for product grid / rail tiles. */
export const PRODUCT_TILE_IMAGE_MAX_WIDTH = 600;

export type ProductTileImageSource = {
  url: string;
  width?: number | null;
  height?: number | null;
  /** Logical tile width in points — drives CDN `width`. */
  tileWidth?: number;
  handle?: string;
};

function productTileDeliveryWidth(tileWidth?: number): number {
  if (tileWidth == null || tileWidth <= 0) {
    return 400;
  }
  const devicePixels = Math.ceil(tileWidth * PixelRatio.get());
  const stepped = Math.ceil(devicePixels / 50) * 50;
  return Math.min(PRODUCT_TILE_IMAGE_MAX_WIDTH, Math.max(200, stepped));
}

/**
 * Device-sized Shopify CDN URL for product tiles (grid, rails, search thumbs).
 */
export function productTileImageUri(source: ProductTileImageSource): string {
  const originalUrl = source.url.trim();
  if (!originalUrl) return originalUrl;

  const targetWidth = productTileDeliveryWidth(source.tileWidth);

  if (!isShopifyCdnUrl(originalUrl)) {
    return originalUrl;
  }

  const transformedUrl = applyShopifyCdnImageParams(originalUrl, targetWidth);

  return transformedUrl;
}
