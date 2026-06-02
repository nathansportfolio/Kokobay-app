import type { QueryClient } from '@tanstack/react-query';

import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { fetchWishlistProductPreviews } from '@/services/kokobay-web/wishlist-products';
import { getProduct } from '@/services/shopify';
import type { Product } from '@/types/shopify';
import { wishlistPreviewToProduct } from '@/utils/wishlist-product-mapper';
import type { wishlistProductsQueryKey } from '@/utils/wishlist-query-key';

type WishlistCacheKey = ReturnType<typeof wishlistProductsQueryKey>;

export type WishlistProductsMap = Record<string, Product>;

/** Keep only products still in the wishlist — no network. */
export function pruneWishlistProductsMap(
  previous: WishlistProductsMap | undefined,
  handles: readonly string[],
): WishlistProductsMap | undefined {
  if (!previous) return previous;
  const next: WishlistProductsMap = {};
  for (const handle of handles) {
    if (previous[handle]) next[handle] = previous[handle];
  }
  return next;
}

async function fetchWishlistProductsChunk(
  handles: readonly string[],
  currencyCode: string,
  signal?: AbortSignal,
): Promise<WishlistProductsMap> {
  const map: WishlistProductsMap = {};

  if (handles.length === 0) return map;

  if (isKokobayWebProductsConfigured()) {
    const previews = await fetchWishlistProductPreviews(handles, { signal });
    for (const preview of previews) {
      const product = wishlistPreviewToProduct(preview, currencyCode);
      if (product) map[preview.handle] = product;
    }
    return map;
  }

  await Promise.all(
    handles.map(async (handle) => {
      const product = await getProduct(handle, { signal });
      if (product) map[handle] = product;
    }),
  );
  return map;
}

/**
 * Incremental wishlist product load — fetches only handles missing from cache.
 * Removals prune locally without refetching the full list.
 */
export async function syncWishlistProductsMap(
  queryClient: QueryClient,
  cacheKey: WishlistCacheKey,
  handles: readonly string[],
  currencyCode: string,
  signal?: AbortSignal,
): Promise<WishlistProductsMap> {
  const previous = queryClient.getQueryData<WishlistProductsMap>(cacheKey);
  const pruned = pruneWishlistProductsMap(previous, handles) ?? {};

  const missing = handles.filter((handle) => !pruned[handle]);
  if (missing.length === 0) {
    return pruned;
  }

  const fetched = await fetchWishlistProductsChunk(missing, currencyCode, signal);
  return { ...pruned, ...fetched };
}
