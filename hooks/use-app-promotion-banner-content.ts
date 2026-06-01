import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { APP_PROMOTION_BANNER_STRIP_HEIGHT } from '@/constants/app-promotion-banner';
import {
  fetchAppPromotionBanner,
  type AppPromotionBannerPayload,
} from '@/services/kokobay-web/app-promotion-banner';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';

const APP_PROMOTION_BANNER_QUERY_KEY = ['app-promotion-banner'] as const;

export function useAppPromotionBannerContent() {
  const queryClient = useQueryClient();
  const enabled = isKokobayWebProductsConfigured();

  const query = useQuery<AppPromotionBannerPayload | null>({
    queryKey: [...APP_PROMOTION_BANNER_QUERY_KEY],
    enabled,
    staleTime: 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) => fetchAppPromotionBanner({ signal }),
  });

  const data = query.data ?? null;
  const visible = Boolean(data?.active && data.message.trim());

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...APP_PROMOTION_BANNER_QUERY_KEY] });
  }, [queryClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return {
    visible,
    loading: enabled && query.isPending,
    message: data?.message ?? '',
    refresh,
  };
}

export function useAppPromotionBannerChromeHeight(): number {
  const { visible } = useAppPromotionBannerContent();
  return visible ? APP_PROMOTION_BANNER_STRIP_HEIGHT : 0;
}
