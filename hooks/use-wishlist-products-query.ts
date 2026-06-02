import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  WISHLIST_HANDLES_DEBOUNCE_MS,
  WISHLIST_PRODUCTS_GC_TIME_MS,
  WISHLIST_PRODUCTS_STALE_TIME_MS,
} from '@/constants/wishlist-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { useMarketStore } from '@/store/market-preference';
import {
  pruneWishlistProductsMap,
  syncWishlistProductsMap,
  type WishlistProductsMap,
} from '@/utils/wishlist-products-sync';
import {
  wishlistProductsQueryKey,
  wishlistProductsQueryKeyWithRevision,
} from '@/utils/wishlist-query-key';

/** Batched wishlist previews — debounced handles, delta fetches, compact query revision. */
export function useWishlistProductsQuery(handles: readonly string[], enabled: boolean) {
  const queryClient = useQueryClient();
  const marketKey = useMarketQueryKey();
  const currencyCode = useMarketStore((s) => s.currencyCode);
  const debouncedHandles = useDebouncedValue(handles, WISHLIST_HANDLES_DEBOUNCE_MS);
  const cacheKey = wishlistProductsQueryKey(marketKey);
  const queryKey = wishlistProductsQueryKeyWithRevision(marketKey, debouncedHandles);
  const listEnabled = enabled && debouncedHandles.length > 0;

  return useQuery<WishlistProductsMap>({
    queryKey,
    queryFn: async ({ signal }) => {
      const result = await syncWishlistProductsMap(
        queryClient,
        cacheKey,
        debouncedHandles,
        currencyCode,
        signal,
      );
      queryClient.setQueryData(cacheKey, result);
      return result;
    },
    enabled: listEnabled,
    staleTime: WISHLIST_PRODUCTS_STALE_TIME_MS,
    gcTime: WISHLIST_PRODUCTS_GC_TIME_MS,
    placeholderData: (previous) =>
      pruneWishlistProductsMap(previous, debouncedHandles) ??
      pruneWishlistProductsMap(queryClient.getQueryData(cacheKey), debouncedHandles) ??
      previous,
    refetchOnMount: false,
  });
}

export type { WishlistProductsMap };
