import type { CmsCollectionTile } from '@/services/kokobay-web/collections-cms';
import type { Collection } from '@/types/shopify';
import { extractCollectionHandleFromCmsUrl } from '@/utils/collection-cms-url';

export type CmsCollectionDisplayItem = {
  collection: Collection;
  cmsUrl?: string;
};

export function cmsCollectionTilesToDisplayItems(
  tiles: CmsCollectionTile[],
): CmsCollectionDisplayItem[] {
  return tiles.map((tile) => {
    const handle =
      extractCollectionHandleFromCmsUrl(tile.url) || tile.slug.trim().toLowerCase();
    return {
      cmsUrl: tile.url,
      collection: {
        id: `cms:${tile.slug}`,
        handle,
        title: tile.title,
        image: tile.imageUrl ? { url: tile.imageUrl } : null,
      },
    };
  });
}
