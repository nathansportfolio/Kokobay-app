import type { QueryClient } from '@tanstack/react-query';

import {
  fetchAppPromotionBanner,
  type AppPromotionBannerPayload,
} from '@/services/kokobay-web/app-promotion-banner';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { recordPromotionInvalidate } from '@/lib/resume-perf';
import { isJsFreezeAuditEnabled, isJsFreezeSessionActive, traceLongTask } from '@/lib/js-freeze-audit';

export const APP_PROMOTION_BANNER_QUERY_KEY = ['app-promotion-banner'] as const;

export function appPromotionBannerQueryKey(marketKey: string) {
  return [...APP_PROMOTION_BANNER_QUERY_KEY, marketKey] as const;
}

export function appPromotionBannerQueryOptions(marketKey: string) {
  return {
    queryKey: appPromotionBannerQueryKey(marketKey),
    staleTime: 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchAppPromotionBanner(marketKey, { signal }),
  } as const;
}

export function isAppPromotionBannerQueryEnabled(): boolean {
  return isKokobayWebProductsConfigured();
}

export function appPromotionBannerVisible(data: AppPromotionBannerPayload | null | undefined): boolean {
  return Boolean(data?.active && data.message.trim());
}

/** True when cached banner data is still within `staleTime` — skip foreground invalidation. */
export function isAppPromotionBannerQueryFresh(
  queryClient: QueryClient,
  marketKey: string,
): boolean {
  const state = queryClient.getQueryState(appPromotionBannerQueryKey(marketKey));
  if (!state?.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt < appPromotionBannerQueryOptions(marketKey).staleTime;
}

/** Single invalidation entry point — used by provider and manual refresh. */
export function invalidateAppPromotionBanner(
  queryClient: QueryClient,
  source: string,
): Promise<void> {
  recordPromotionInvalidate(source);
  const run = () => queryClient.invalidateQueries({ queryKey: [...APP_PROMOTION_BANNER_QUERY_KEY] });
  if (isJsFreezeAuditEnabled() && isJsFreezeSessionActive()) {
    return traceLongTask(`promotion.invalidate:${source}`, () => run());
  }
  return run();
}
