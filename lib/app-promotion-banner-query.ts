import type { QueryClient } from '@tanstack/react-query';

import {
  fetchAppPromotionBanner,
  type AppPromotionBannerPayload,
} from '@/services/kokobay-web/app-promotion-banner';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { recordPromotionInvalidate } from '@/lib/resume-perf';

export const APP_PROMOTION_BANNER_QUERY_KEY = ['app-promotion-banner'] as const;

export const appPromotionBannerQueryOptions = {
  queryKey: [...APP_PROMOTION_BANNER_QUERY_KEY],
  staleTime: 60_000,
  gcTime: 60 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAppPromotionBanner({ signal }),
} as const;

export function isAppPromotionBannerQueryEnabled(): boolean {
  return isKokobayWebProductsConfigured();
}

export function appPromotionBannerVisible(data: AppPromotionBannerPayload | null | undefined): boolean {
  return Boolean(data?.active && data.message.trim());
}

/** True when cached banner data is still within `staleTime` — skip foreground invalidation. */
export function isAppPromotionBannerQueryFresh(queryClient: QueryClient): boolean {
  const state = queryClient.getQueryState([...APP_PROMOTION_BANNER_QUERY_KEY]);
  if (!state?.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt < appPromotionBannerQueryOptions.staleTime;
}

/** Single invalidation entry point — used by provider and manual refresh. */
export function invalidateAppPromotionBanner(
  queryClient: QueryClient,
  source: string,
): Promise<void> {
  recordPromotionInvalidate(source);
  return queryClient.invalidateQueries({ queryKey: [...APP_PROMOTION_BANNER_QUERY_KEY] });
}
