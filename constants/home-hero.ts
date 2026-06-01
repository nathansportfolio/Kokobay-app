import { PixelRatio } from 'react-native';

import { applyShopifyCdnImageParams } from '@/utils/shopify-cdn-image';

/** Editorial hero — New in collection campaign image (Shopify CDN). */
const HOME_NEW_IN_HERO_BASE =
  'https://www.kokobay.co.uk/cdn/shop/collections/20250303_171037140_iOS.jpg?v=1754496329';

/**
 * Device-sized Shopify CDN URL for the built-in default home hero (webp in production, png in iOS dev).
 */
export function homeNewInHeroImageUri(screenWidth: number): string {
  const devicePixels = Math.ceil(screenWidth * PixelRatio.get());
  const width = Math.min(1600, Math.max(800, Math.ceil(devicePixels / 50) * 50));
  return applyShopifyCdnImageParams(HOME_NEW_IN_HERO_BASE, width);
}

/** @deprecated Prefer {@link homeNewInHeroImageUri} for device-sized delivery. */
export const HOME_NEW_IN_HERO_URI = homeNewInHeroImageUri(390);

/** @deprecated Prefer {@link newInCollectionHref} from `@/utils/collection-handles`. */
export { primaryNewInCollectionHandle as HOME_NEW_IN_COLLECTION_HANDLE } from '@/utils/collection-handles';
