import type { Collection } from '@/types/shopify';
import { canonicalCollectionHandle } from '@/utils/collection-handles';
import type { CmsCollectionDisplayItem } from '@/utils/cms-collection-tiles';

export function buildCollectionsTabCatalogMap(
  cmsItems: CmsCollectionDisplayItem[],
  catalogCollections: Collection[] | undefined,
): Map<string, Collection> {
  const map = new Map<string, Collection>();

  for (const collection of catalogCollections ?? []) {
    map.set(canonicalCollectionHandle(collection.handle), collection);
  }

  for (const item of cmsItems) {
    const key = canonicalCollectionHandle(item.collection.handle);
    const existing = map.get(key);
    map.set(key, {
      ...(existing ?? item.collection),
      ...item.collection,
      id: existing?.id ?? item.collection.id,
      handle: existing?.handle ?? item.collection.handle,
      title: item.collection.title || existing?.title || item.collection.handle,
      image: item.collection.image?.url ? item.collection.image : (existing?.image ?? item.collection.image),
    });
  }

  return map;
}

export function enrichCollectionsTabDisplayItem(
  item: CmsCollectionDisplayItem,
  catalog: Map<string, Collection>,
): CmsCollectionDisplayItem {
  const hit = catalog.get(canonicalCollectionHandle(item.collection.handle));
  if (!hit) return item;

  return {
    ...item,
    collection: {
      ...hit,
      ...item.collection,
      id: item.collection.id,
      handle: item.collection.handle,
      title: item.collection.title || hit.title,
      description: hit.description ?? item.collection.description,
      descriptionHtml: hit.descriptionHtml ?? item.collection.descriptionHtml,
      image: item.collection.image?.url ? item.collection.image : hit.image,
    },
  };
}
