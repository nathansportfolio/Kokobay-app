import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { APP_PROMOTION_BANNER_STRIP_HEIGHT } from '@/constants/app-promotion-banner';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import {
  appPromotionBannerQueryOptions,
  appPromotionBannerVisible,
  invalidateAppPromotionBanner,
  isAppPromotionBannerQueryEnabled,
} from '@/lib/app-promotion-banner-query';
import type { AppPromotionBannerPayload } from '@/services/kokobay-web/app-promotion-banner';

export { APP_PROMOTION_BANNER_QUERY_KEY } from '@/lib/app-promotion-banner-query';

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
  const visible = useAppPromotionBannerVisible();
  return visible ? APP_PROMOTION_BANNER_STRIP_HEIGHT : 0;
}
