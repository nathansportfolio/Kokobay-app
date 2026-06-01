import { PixelRatio } from 'react-native';

import { applyShopifyCdnImageParams } from '@/utils/shopify-cdn-image';

/** Device-sized Shopify CDN URL for a CMS home hero image. */
export function homeHeroDisplayImageUri(imageUrl: string, screenWidth: number): string {
  const devicePixels = Math.ceil(screenWidth * PixelRatio.get());
  const targetWidth = Math.min(1600, Math.max(800, Math.ceil(devicePixels / 50) * 50));
  return applyShopifyCdnImageParams(imageUrl, targetWidth);
}
