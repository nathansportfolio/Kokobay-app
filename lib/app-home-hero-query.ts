import type { QueryClient } from '@tanstack/react-query';

import { APP_HOME_HERO_QUERY_KEY } from '@/constants/app-home-hero-cms';
import { isJsFreezeAuditEnabled, isJsFreezeSessionActive, traceLongTask } from '@/lib/js-freeze-audit';
import { recordHomeHeroInvalidate } from '@/lib/resume-perf';
import { fetchAppHomeHero, type AppHomeHeroPayload } from '@/services/kokobay-web/app-home-hero';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';

export const HOME_HERO_STALE_MS = 5 * 60_000;
export const HOME_HERO_GC_MS = 60 * 60_000;

export function appHomeHeroQueryKey(marketKey: string) {
  return [...APP_HOME_HERO_QUERY_KEY, marketKey] as const;
}

export function appHomeHeroQueryOptions(marketKey: string) {
  return {
    queryKey: appHomeHeroQueryKey(marketKey),
    staleTime: HOME_HERO_STALE_MS,
    gcTime: HOME_HERO_GC_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAppHomeHero(marketKey, { signal }),
  } as const;
}

export function isAppHomeHeroQueryEnabled(): boolean {
  return isKokobayWebProductsConfigured();
}

/** True when cached hero data is still within `staleTime` — skip foreground invalidation. */
export function isAppHomeHeroQueryFresh(queryClient: QueryClient, marketKey: string): boolean {
  const state = queryClient.getQueryState<AppHomeHeroPayload | null>(appHomeHeroQueryKey(marketKey));
  if (!state?.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt < appHomeHeroQueryOptions(marketKey).staleTime;
}

/** Single invalidation entry point — used by sync provider and manual refresh. */
export function invalidateAppHomeHero(queryClient: QueryClient, source: string): Promise<void> {
  recordHomeHeroInvalidate(source);
  const run = () => queryClient.invalidateQueries({ queryKey: [...APP_HOME_HERO_QUERY_KEY] });
  if (isJsFreezeAuditEnabled() && isJsFreezeSessionActive()) {
    return traceLongTask(`home_hero.invalidate:${source}`, () => run());
  }
  return run();
}
