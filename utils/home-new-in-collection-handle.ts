import { extractCollectionHandleFromCmsUrl } from '@/utils/collection-cms-url';
import { LIVE_NEW_IN_COLLECTION_HANDLE } from '@/utils/collection-handles';

/** Collection handle for home “Latest arrivals” — from CMS hero CTA, else default. */
export function resolveHomeNewInCollectionHandle(buttonLink?: string): string {
  const fromCms = extractCollectionHandleFromCmsUrl(buttonLink?.trim() ?? '');
  return fromCms || LIVE_NEW_IN_COLLECTION_HANDLE;
}
