import { useQuery } from '@tanstack/react-query';

import { fetchSizeGuideFromApi } from '@/services/kokobay-web/size-guide';
import { sizeGuideQueryKey } from '@/src/core/query/query-keys';

/** Matches storefront API cache TTL (4 hours). */
export const SIZE_GUIDE_STALE_MS = 4 * 60 * 60_000;

export function useSizeGuideQuery(enabled = true) {
  return useQuery({
    queryKey: sizeGuideQueryKey,
    staleTime: SIZE_GUIDE_STALE_MS,
    queryFn: ({ signal }) => fetchSizeGuideFromApi({ signal }),
    enabled,
  });
}
