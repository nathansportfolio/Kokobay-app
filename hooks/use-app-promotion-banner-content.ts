import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { APP_PROMOTION_BANNER_STRIP_HEIGHT } from '@/constants/app-promotion-banner';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import {
  appPromotionBannerQueryKey,
  appPromotionBannerQueryOptions,
  appPromotionBannerVisible,
  invalidateAppPromotionBanner,
  isAppPromotionBannerQueryEnabled,
} from '@/lib/app-promotion-banner-query';
import { logPlpChromeSnap } from '@/lib/plp-chrome-snap-trace';
import type { AppPromotionBannerPayload } from '@/services/kokobay-web/app-promotion-banner';

export { APP_PROMOTION_BANNER_QUERY_KEY } from '@/lib/app-promotion-banner-query';

/** Reserve promo strip height until the first fetch settles to avoid top-chrome layout snap. */
export function resolveAppPromotionBannerChromeHeight(
  enabled: boolean,
  data: AppPromotionBannerPayload | null | undefined,
  isFetched: boolean,
): number {
  if (!enabled) return 0;
  if (appPromotionBannerVisible(data)) return APP_PROMOTION_BANNER_STRIP_HEIGHT;
  if (!isFetched) return APP_PROMOTION_BANNER_STRIP_HEIGHT;
  return 0;
}

/** Subscribe to promotion banner query — no AppState listeners (see AppPromotionBannerSync). */
export function useAppPromotionBannerContent() {
  const queryClient = useQueryClient();
  const marketKey = useMarketQueryKey();
  const enabled = isAppPromotionBannerQueryEnabled();

  const query = useQuery<AppPromotionBannerPayload | null>({
    ...appPromotionBannerQueryOptions(marketKey),
    enabled,
    placeholderData: (previous) => previous,
  });

  const data = query.data ?? null;
  const visible = appPromotionBannerVisible(data);

  const refresh = useCallback(() => {
    void invalidateAppPromotionBanner(queryClient, 'manual');
  }, [queryClient]);

  return {
    visible,
    loading: enabled && query.isPending,
    message: data?.message ?? '',
    refresh,
  };
}

/** Lightweight visibility subscriber — same cache, no side effects. */
export function useAppPromotionBannerVisible(): boolean {
  const marketKey = useMarketQueryKey();
  const enabled = isAppPromotionBannerQueryEnabled();
  const query = useQuery<AppPromotionBannerPayload | null>({
    ...appPromotionBannerQueryOptions(marketKey),
    enabled,
    placeholderData: (previous) => previous,
  });
  return appPromotionBannerVisible(query.data ?? null);
}

export function useAppPromotionBannerChromeHeight(): number {
  const queryClient = useQueryClient();
  const marketKey = useMarketQueryKey();
  const enabled = isAppPromotionBannerQueryEnabled();
  const query = useQuery<AppPromotionBannerPayload | null>({
    ...appPromotionBannerQueryOptions(marketKey),
    enabled,
    placeholderData: (previous) => previous,
  });
  const cached =
    query.data ??
    queryClient.getQueryData<AppPromotionBannerPayload | null>(appPromotionBannerQueryKey(marketKey));
  const chromeHeight = resolveAppPromotionBannerChromeHeight(enabled, cached, query.isFetched);

  const prevTraceRef = useRef<string | null>(null);
  useEffect(() => {
    const traceKey = [
      enabled,
      query.isPending,
      query.isFetching,
      query.isFetched,
      query.isFetchedAfterMount,
      query.fetchStatus,
      query.dataUpdatedAt,
      chromeHeight,
      appPromotionBannerVisible(cached),
      Boolean(cached),
    ].join(':');
    if (prevTraceRef.current === traceKey) return;
    prevTraceRef.current = traceKey;
    logPlpChromeSnap('promotion_banner_chrome', {
      marketKey,
      enabled,
      isPending: query.isPending,
      isFetching: query.isFetching,
      isFetched: query.isFetched,
      isFetchedAfterMount: query.isFetchedAfterMount,
      fetchStatus: query.fetchStatus,
      dataUpdatedAt: query.dataUpdatedAt,
      hasQueryData: query.data != null,
      hasCachedData: cached != null,
      visible: appPromotionBannerVisible(cached),
      optimisticReserve: enabled && !query.isFetched && !appPromotionBannerVisible(cached),
      chromeHeight,
      active: cached?.active ?? null,
      messageLength: cached?.message?.trim().length ?? 0,
    });
  }, [
    cached,
    chromeHeight,
    enabled,
    marketKey,
    query.data,
    query.dataUpdatedAt,
    query.fetchStatus,
    query.isFetched,
    query.isFetchedAfterMount,
    query.isFetching,
    query.isPending,
  ]);

  return chromeHeight;
}
