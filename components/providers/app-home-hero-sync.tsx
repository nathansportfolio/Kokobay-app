import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import {
  invalidateAppHomeHero,
  isAppHomeHeroQueryEnabled,
  isAppHomeHeroQueryFresh,
} from '@/lib/app-home-hero-query';
import { registerTrackedAppStateListener } from '@/lib/lifecycle-perf/install';
import {
  logHomeHeroForegroundMetrics,
  logResumePerf,
  resetHomeHeroInvalidateCount,
  traceResumeHandlerSync,
} from '@/lib/resume-perf';

/** One global AppState listener for home hero foreground refresh. */
export function AppHomeHeroSync() {
  const queryClient = useQueryClient();
  const marketKey = useMarketQueryKey();
  const enabled = isAppHomeHeroQueryEnabled();
  const prevStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;

    return registerTrackedAppStateListener('app-home-hero-sync', (state) => {
      const prev = prevStateRef.current;
      prevStateRef.current = state;

      const enteredForeground =
        state === 'active' && (prev === 'background' || prev === 'inactive');
      if (!enteredForeground) return;

      resetHomeHeroInvalidateCount();

      if (isAppHomeHeroQueryFresh(queryClient, marketKey)) {
        logResumePerf('home_hero_invalidate_skipped', { reason: 'query_fresh' });
        logHomeHeroForegroundMetrics();
        return;
      }

      traceResumeHandlerSync('home_hero.invalidate:app_state', () => {
        void invalidateAppHomeHero(queryClient, 'app_state');
      });
      logHomeHeroForegroundMetrics();
    });
  }, [enabled, marketKey, queryClient]);

  return null;
}
