import type { QueryClient } from '@tanstack/react-query';
import type { ViewToken } from 'react-native';
import { useEffect, useRef, type RefObject } from 'react';
import type { ViewabilityConfig } from 'react-native';

import { prefetchVisibleProductGalleries } from '@/lib/product-card-gallery-prefetch';
import { clearVisibleProductCardIds, syncVisibleProductCardIds } from '@/lib/product-card-visibility';

export const PLP_PRODUCT_GRID_VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 0,
};

export type PlpGridGalleryPrefetchTarget = {
  productId: string;
  handle: string;
};

type UsePlpGridViewabilityOptions<T> = {
  /** Map a list row to the product id used by `ProductCard`. */
  resolveProductId?: (item: T) => string | undefined;
  /** When set with `queryClientRef` + `marketKeyRef`, prefetches gallery metadata for visible rows. */
  resolveGalleryPrefetch?: (item: T) => PlpGridGalleryPrefetchTarget | undefined;
  queryClientRef?: RefObject<QueryClient>;
  marketKeyRef?: RefObject<string>;
  enabled?: boolean;
};

/**
 * FlashList viewability wiring for product grids.
 * Updates a shared visibility store — no list `extraData` / parent state.
 * Gallery metadata prefetch is imperative (React Query cache only).
 */
export function usePlpGridViewability<T>(options: UsePlpGridViewabilityOptions<T> = {}) {
  const {
    resolveProductId,
    resolveGalleryPrefetch,
    queryClientRef,
    marketKeyRef,
    enabled = true,
  } = options;
  const resolveIdRef = useRef(resolveProductId);
  resolveIdRef.current = resolveProductId;
  const resolveGalleryRef = useRef(resolveGalleryPrefetch);
  resolveGalleryRef.current = resolveGalleryPrefetch;

  useEffect(() => {
    if (!enabled) {
      clearVisibleProductCardIds();
    }
    return () => {
      clearVisibleProductCardIds();
    };
  }, [enabled]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      if (!enabled) return;

      const ids = new Set<string>();
      const galleryTargets: PlpGridGalleryPrefetchTarget[] = [];

      for (const token of viewableItems) {
        if (!token.isViewable || token.item == null) continue;
        const item = token.item as T;
        const id = resolveIdRef.current?.(item);
        if (id) ids.add(id);

        const gallery = resolveGalleryRef.current?.(item);
        if (gallery?.productId && gallery.handle) {
          galleryTargets.push(gallery);
        }
      }

      const queryClient = queryClientRef?.current;
      const marketKey = marketKeyRef?.current;
      if (queryClient && marketKey && galleryTargets.length > 0) {
        prefetchVisibleProductGalleries(queryClient, marketKey, galleryTargets);
      }

      syncVisibleProductCardIds(ids);
    },
  ).current;

  const viewabilityConfig = useRef(PLP_PRODUCT_GRID_VIEWABILITY_CONFIG).current;

  return {
    onViewableItemsChanged,
    viewabilityConfig,
  };
}

/** Default resolver for `FlashList<Product>` grids. */
export function plpGridProductIdFromItem(item: { id?: string | null }): string | undefined {
  const id = item.id?.trim();
  return id || undefined;
}

export function plpGridGalleryPrefetchFromProduct(item: {
  id?: string | null;
  handle?: string | null;
}): PlpGridGalleryPrefetchTarget | undefined {
  const productId = item.id?.trim();
  const handle = item.handle?.trim();
  if (!productId || !handle) return undefined;
  return { productId, handle };
}
