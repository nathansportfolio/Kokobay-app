import { Image } from 'expo-image';

import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';
import { shopCollectionCoverUri } from '@/utils/shop-collection-cover-uri';
import { shopifyCdnUriForPlatform } from '@/utils/shopify-cdn-image';

/** First visible collection strip rows — matches FlashList `imagePriority` cutoff. */
export const SHOP_COLLECTION_VIEWPORT_PREFETCH_COUNT = 6;

export function shopCollectionCoverUrisFromItems(
  items: CmsCollectionDisplayItem[],
  options?: { screenWidth?: number; limit?: number },
): string[] {
  const limit = options?.limit ?? SHOP_COLLECTION_VIEWPORT_PREFETCH_COUNT;
  const seen = new Set<string>();
  const uris: string[] = [];

  for (const item of items.slice(0, limit)) {
    const raw = item.collection.image?.url?.trim();
    if (!raw) continue;

    const sized = shopCollectionCoverUri({
      url: raw,
      width: item.collection.image?.width,
      height: item.collection.image?.height,
      handle: item.collection.handle,
      screenWidth: options?.screenWidth,
    });

    const resolved = shopifyCdnUriForPlatform(sized.trim());
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    uris.push(resolved);
  }

  return uris;
}

/**
 * Warm expo-image cache for the first viewport of collection covers.
 * Fire-and-forget — does not block render.
 */
export function prefetchShopCollectionCoverImages(
  items: CmsCollectionDisplayItem[],
  options?: { screenWidth?: number; limit?: number },
): number {
  const uris = shopCollectionCoverUrisFromItems(items, options);
  for (const uri of uris) {
    void Image.prefetch(uri);
  }
  return uris.length;
}
