import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { APP_ERROR_BANNER_STRIP_HEIGHT } from '@/constants/app-error-banner';
import { useAppPromotionBannerChromeHeight } from '@/hooks/use-app-promotion-banner-content';
import { kokobayApiEnvDebug, resolveKokobayApiBaseUrl } from '@/services/kokobay-web/api-config';
import { fetchAppErrorBanner, type AppErrorBannerPayload } from '@/services/kokobay-web/app-error';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';

const APP_ERROR_QUERY_KEY = ['app-error'] as const;

function logAppErrorBannerState(payload: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log('[AppErrorBanner]', payload);
}

export function useAppErrorBannerContent() {
  const queryClient = useQueryClient();
  const enabled = isKokobayWebProductsConfigured();

  const query = useQuery<AppErrorBannerPayload | null>({
    queryKey: [...APP_ERROR_QUERY_KEY],
    enabled,
    staleTime: 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) => fetchAppErrorBanner({ signal }),
  });

  const data = query.data ?? null;
  const visible = Boolean(data?.active && data.message.trim());

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...APP_ERROR_QUERY_KEY] });
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

  useEffect(() => {
    const cmsLookup =
      query.isPending || query.fetchStatus === 'fetching'
        ? 'loading'
        : data != null
          ? 'found'
          : 'not_found (inactive or GET /api/app-error 404)';

    logAppErrorBannerState({
      shouldShow: visible,
      cmsLookup,
      loading: enabled && query.isPending,
      message: data?.message || '(empty)',
      queryStatus: query.status,
      queryFetchStatus: query.fetchStatus,
      apiEnabled: enabled,
      apiBaseUrl: resolveKokobayApiBaseUrl(),
      apiEnv: kokobayApiEnvDebug(),
    });
  }, [visible, data, query.isPending, query.status, query.fetchStatus, enabled]);

  return {
    visible,
    loading: enabled && query.isPending,
    title: '',
    content: data?.message ?? '',
    richContent: undefined,
    refresh,
  };
}

/** Extra chrome height to reserve below the fixed tab/stack header row (promotion + error). */
export function useAppErrorBannerChromeHeight(): number {
  const { visible } = useAppErrorBannerContent();
  const promotionChrome = useAppPromotionBannerChromeHeight();
  const errorChrome = visible ? APP_ERROR_BANNER_STRIP_HEIGHT : 0;
  return promotionChrome + errorChrome;
}
