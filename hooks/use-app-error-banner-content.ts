import { useQuery } from '@tanstack/react-query';

import { APP_ERROR_BANNER_STRIP_HEIGHT } from '@/constants/app-error-banner';
import { useAppPromotionBannerChromeHeight } from '@/hooks/use-app-promotion-banner-content';
import { fetchAppErrorBanner, type AppErrorBannerPayload } from '@/services/kokobay-web/app-error';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';

export const APP_ERROR_QUERY_KEY = ['app-error'] as const;

const APP_ERROR_STALE_MS = 5 * 60_000;

/** Shopify incident strip — off by default (separate from POST /api/app/error-log). */
export function isIncidentBannerEnabled(): boolean {
  return process.env.EXPO_PUBLIC_INCIDENT_BANNER_ENABLED === 'true';
}

export function useAppErrorBannerContent() {
  const enabled = isKokobayWebProductsConfigured() && isIncidentBannerEnabled();

  const query = useQuery<AppErrorBannerPayload | null>({
    queryKey: [...APP_ERROR_QUERY_KEY],
    enabled,
    staleTime: APP_ERROR_STALE_MS,
    gcTime: 60 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: false,
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) => fetchAppErrorBanner({ signal }),
  });

  const data = query.data ?? null;
  const visible = Boolean(enabled && data?.active && data.message.trim());

  return {
    visible,
    loading: enabled && query.isPending,
    title: '',
    content: data?.message ?? '',
    richContent: undefined,
  };
}

/** Extra chrome height to reserve below the fixed tab/stack header row (promotion + error). */
export function useAppErrorBannerChromeHeight(): number {
  const { visible } = useAppErrorBannerContent();
  const promotionChrome = useAppPromotionBannerChromeHeight();
  const errorChrome = visible ? APP_ERROR_BANNER_STRIP_HEIGHT : 0;
  return promotionChrome + errorChrome;
}
