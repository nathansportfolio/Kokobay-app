import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, type AppStateStatus } from 'react-native';

import {
  attachForegroundAuditStoreWatchers,
  beginForegroundAudit,
  detachForegroundAuditStoreWatchers,
  finishForegroundAuditSummary,
  FOREGROUND_AUDIT_WINDOW_MS,
  isForegroundAuditEnabled,
  recordForegroundInteractionsComplete,
  recordForegroundJsResponsivenessStart,
  recordForegroundTransition,
} from '@/lib/foreground-audit';
import { getActiveTimerCount } from '@/lib/lifecycle-perf';
import { registerTrackedAppStateListener } from '@/lib/lifecycle-perf/install';

/**
 * Foreground resume audit — instrumentation only.
 * Foreground resume audit — set `EXPO_PUBLIC_FOREGROUND_AUDIT=1`. Filter Metro with `[FOREGROUND]`.
 */
export function ForegroundAuditSync() {
  const prevStateRef = useRef<AppStateStatus>(AppState.currentState);
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isForegroundAuditEnabled()) return;

    const removeAppState = registerTrackedAppStateListener('foreground-audit-sync', (next) => {
      const prev = prevStateRef.current;
      prevStateRef.current = next;

      if (next !== 'active' || prev === 'active') return;

      if (summaryTimerRef.current) {
        clearTimeout(summaryTimerRef.current);
        detachForegroundAuditStoreWatchers();
      }

      const transition =
        prev === 'background' ? ('background->active' as const) : ('inactive->active' as const);

      recordForegroundTransition(prev, next);
      beginForegroundAudit({
        transition,
        timerBaseline: getActiveTimerCount(),
      });

      attachForegroundAuditStoreWatchers();

      const jsStart = recordForegroundJsResponsivenessStart();
      InteractionManager.runAfterInteractions(() => {
        recordForegroundInteractionsComplete(jsStart);
      });

      summaryTimerRef.current = setTimeout(() => {
        summaryTimerRef.current = undefined;
        finishForegroundAuditSummary({ activeTimerCount: getActiveTimerCount() });
        detachForegroundAuditStoreWatchers();
      }, FOREGROUND_AUDIT_WINDOW_MS);
    });

    return () => {
      removeAppState();
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current);
      detachForegroundAuditStoreWatchers();
    };
  }, []);

  return null;
}
