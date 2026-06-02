import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, type AppStateStatus } from 'react-native';

import {
  beginForegroundPerfBaseline,
  finishForegroundPerfSummary,
  markForegroundInteractionsIdle,
} from '@/lib/foreground-perf';
import {
  getActiveTimerCount,
  getPendingNetworkRequestCount,
  getRenderCountsSnapshot,
} from '@/lib/lifecycle-perf';
import { registerTrackedAppStateListener } from '@/lib/lifecycle-perf/install';
import { installResumeQueryObserver } from '@/lib/resume-query-observer';
import {
  beginResumePerfRun,
  finishResumePerfRun,
  getResumeTrackedHandlerMs,
  markResumePerf,
} from '@/lib/resume-perf';

const FINISH_RUN_DELAY_MS = 8_000;

/**
 * Root AppState listener for resume profiling — does not perform app work itself.
 * Handlers log via `traceResumeHandler` / cart / query observer.
 */
export function ResumePerfSync() {
  const queryClient = useQueryClient();
  const prevStateRef = useRef<AppStateStatus>(AppState.currentState);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => installResumeQueryObserver(queryClient), [queryClient]);

  useEffect(() => {
    const scheduleFinish = (runId: string) => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      finishTimerRef.current = setTimeout(() => {
        finishResumePerfRun(runId);
        finishForegroundPerfSummary({
          renderCounts: getRenderCountsSnapshot(),
          activeTimerCount: getActiveTimerCount(),
          pendingNetworkRequests: getPendingNetworkRequestCount(),
          trackedHandlerMs: getResumeTrackedHandlerMs(),
        });
        finishTimerRef.current = undefined;
      }, FINISH_RUN_DELAY_MS);
    };

    const removeAppState = registerTrackedAppStateListener('resume-perf-sync', (next) => {
      const prev = prevStateRef.current;
      prevStateRef.current = next;

      if (next !== 'active' || prev === 'active') return;

      beginForegroundPerfBaseline({
        renderCounts: getRenderCountsSnapshot(),
        activeTimerCount: getActiveTimerCount(),
        pendingNetworkRequests: getPendingNetworkRequestCount(),
      });

      const runId = beginResumePerfRun();
      markResumePerf('app_state_transition', { from: prev, to: next });
      scheduleFinish(runId);

      InteractionManager.runAfterInteractions(() => {
        markForegroundInteractionsIdle();
        markResumePerf('js_interactions_idle');
      });
    });

    return () => {
      removeAppState();
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  return null;
}
