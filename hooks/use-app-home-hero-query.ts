import { useQuery } from '@tanstack/react-query';

import { APP_HOME_HERO_QUERY_KEY } from '@/constants/app-home-hero-cms';
import { fetchAppHomeHero, type AppHomeHeroPayload } from '@/services/kokobay-web/app-home-hero';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';

const HOME_HERO_STALE_MS = 30 * 60_000;

/** Shared React Query fetch for `GET /api/content/app-home-hero?country=`. */
export function useAppHomeHeroQuery() {
  const marketKey = useMarketQueryKey();
  const enabled = isKokobayWebProductsConfigured();

  return useQuery<AppHomeHeroPayload | null>({
    queryKey: [...APP_HOME_HERO_QUERY_KEY, marketKey],
    enabled,
    staleTime: HOME_HERO_STALE_MS,
    gcTime: 60 * 60_000,
    queryFn: ({ signal }) => fetchAppHomeHero(marketKey, { signal }),
  });
}
