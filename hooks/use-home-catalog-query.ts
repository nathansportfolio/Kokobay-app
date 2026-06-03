import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAppHomeHeroQuery } from '@/hooks/use-app-home-hero-query';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { isAndroidDevClient } from '@/lib/dev-android-network';
import { fetchHomeCatalogData } from '@/services/home-catalog';
import { resolveHomeNewInCollectionHandle } from '@/utils/home-new-in-collection-handle';

const HOME_CATALOG_STALE_MS = 4 * 60_000;
const ANDROID_DEV_CATALOG_RETRIES = 3;

export function homeCatalogQueryKey(marketKey: string, newInHandle: string) {
  return ['home', 'catalog', marketKey, newInHandle] as const;
}

/** Home + search overlay catalog; `newIn` collection follows market-specific CMS hero CTA. */
export function useHomeCatalogQuery() {
  const marketKey = useMarketQueryKey();
  const heroQuery = useAppHomeHeroQuery();
  const newInHandle = useMemo(
    () => resolveHomeNewInCollectionHandle(heroQuery.data?.buttonLink),
    [heroQuery.data?.buttonLink],
  );

  return useQuery({
    queryKey: homeCatalogQueryKey(marketKey, newInHandle),
    staleTime: HOME_CATALOG_STALE_MS,
    placeholderData: keepPreviousData,
    retry: isAndroidDevClient() ? ANDROID_DEV_CATALOG_RETRIES : 1,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
    queryFn: () => fetchHomeCatalogData({ newInCollectionHandle: newInHandle }),
  });
}
