import { PixelRatio } from 'react-native';

import { applyShopifyCdnImageParams, isShopifyCdnUrl } from '@/utils/shopify-cdn-image';

/** Delivery width cap for Shop editorial collection covers. */
export const SHOP_COLLECTION_COVER_TARGET_WIDTH = 800;

export type ShopCollectionCoverSource = {
  url: string;
  width?: number | null;
  height?: number | null;
  handle?: string;
  screenWidth?: number;
};

function shopCollectionCoverDeliveryWidth(screenWidth?: number): number {
  if (screenWidth == null || screenWidth <= 0) {
    return SHOP_COLLECTION_COVER_TARGET_WIDTH;
  }
  const devicePixels = Math.ceil(screenWidth * PixelRatio.get());
  const stepped = Math.ceil(devicePixels / 50) * 50;
  return Math.min(SHOP_COLLECTION_COVER_TARGET_WIDTH, Math.max(400, stepped));
}

function isShopifyCdnHost(url: string): boolean {
  return isShopifyCdnUrl(url);
}

/**
 * Device-sized Shopify CDN URL for Shop collection editorial covers.
 * Sets `width` (aspect ratio preserved by CDN) and `format=webp`.
 */
export function shopCollectionCoverUri(source: ShopCollectionCoverSource): string {
  const originalUrl = source.url.trim();
  if (!originalUrl) return originalUrl;

  const targetWidth = shopCollectionCoverDeliveryWidth(source.screenWidth);

  if (!isShopifyCdnHost(originalUrl)) {
    return originalUrl;
  }

  return applyShopifyCdnImageParams(originalUrl, targetWidth);
}
