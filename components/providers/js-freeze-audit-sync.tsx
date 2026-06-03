import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, type AppStateStatus } from 'react-native';

import {
  beginJsFreezeSession,
  finishJsFreezeReport,
  isJsFreezeAuditEnabled,
  JS_FREEZE_REPORT_WINDOW_MS,
  markJsFreezeTimeline,
  stopJsFreezeSession,
} from '@/lib/js-freeze-audit';
import { registerTrackedAppStateListener } from '@/lib/lifecycle-perf/install';

/**
 * JS thread freeze detection — event loop lag, long tasks, render storms.
 * JS thread freeze detection — set `EXPO_PUBLIC_JS_FREEZE_AUDIT=1` to enable.
 */
export function JsFreezeAuditSync() {
  const prevStateRef = useRef<AppStateStatus>(AppState.currentState);
  const reportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isJsFreezeAuditEnabled()) return;

    const removeAppState = registerTrackedAppStateListener('js-freeze-audit-sync', (next) => {
      const prev = prevStateRef.current;
      prevStateRef.current = next;

      if (next === 'background' || next === 'inactive') {
        if (reportTimerRef.current) {
          clearTimeout(reportTimerRef.current);
          reportTimerRef.current = undefined;
        }
        stopJsFreezeSession();
        return;
      }

      if (next !== 'active' || prev === 'active') return;

      if (reportTimerRef.current) clearTimeout(reportTimerRef.current);

      beginJsFreezeSession();

      InteractionManager.runAfterInteractions(() => {
        markJsFreezeTimeline('render_complete');
      });

      reportTimerRef.current = setTimeout(() => {
        reportTimerRef.current = undefined;
        finishJsFreezeReport();
      }, JS_FREEZE_REPORT_WINDOW_MS);
    });

    return () => {
      removeAppState();
      if (reportTimerRef.current) clearTimeout(reportTimerRef.current);
      stopJsFreezeSession();
    };
  }, []);

  return null;
}
