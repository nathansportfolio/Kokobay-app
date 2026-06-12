import { useQuery } from '@tanstack/react-query';

import {
  appHomeHeroQueryOptions,
  isAppHomeHeroQueryEnabled,
} from '@/lib/app-home-hero-query';
import type { AppHomeHeroPayload } from '@/services/kokobay-web/app-home-hero';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';

/** Shared React Query fetch for `GET /api/content/app-home-hero?country=`. */
export function useAppHomeHeroQuery() {
  const marketKey = useMarketQueryKey();
  const enabled = isAppHomeHeroQueryEnabled();

  return useQuery<AppHomeHeroPayload | null>({
    ...appHomeHeroQueryOptions(marketKey),
    enabled,
  });
}
