import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  invalidateAppPromotionBanner,
  isAppPromotionBannerQueryEnabled,
  isAppPromotionBannerQueryFresh,
} from '@/lib/app-promotion-banner-query';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import { registerTrackedAppStateListener } from '@/lib/lifecycle-perf/install';
import {
  logPromotionForegroundMetrics,
  logResumePerf,
  resetPromotionInvalidateCount,
  traceResumeHandlerSync,
} from '@/lib/resume-perf';

/** One global AppState listener + initial fetch for the promotion banner query. */
export function AppPromotionBannerSync() {
  const queryClient = useQueryClient();
  const marketKey = useMarketQueryKey();
  const enabled = isAppPromotionBannerQueryEnabled();
  const prevStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;

    return registerTrackedAppStateListener('app-promotion-banner-sync', (state) => {
      const prev = prevStateRef.current;
      prevStateRef.current = state;

      const enteredForeground =
        state === 'active' && (prev === 'background' || prev === 'inactive');
      if (!enteredForeground) return;

      resetPromotionInvalidateCount();

      if (isAppPromotionBannerQueryFresh(queryClient, marketKey)) {
        logResumePerf('promotion_invalidate_skipped', { reason: 'query_fresh' });
        logPromotionForegroundMetrics();
        return;
      }

      traceResumeHandlerSync('promotion_banner.invalidate:app_state', () => {
        void invalidateAppPromotionBanner(queryClient, 'app_state');
      });
      logPromotionForegroundMetrics();
    });
  }, [enabled, marketKey, queryClient]);

  return null;
}
