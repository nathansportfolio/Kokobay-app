import { useEffect, useLayoutEffect, useRef } from 'react';

import {
  clearScreenLoadTrace,
  logScreenLoadTrace,
  logScreenLoadTraceOnce,
  resetScreenLoadTrace,
} from '@/lib/screen-load-trace';

export type ScreenLoadQueryTrace = {
  /** Stable label for logs, e.g. JSON.stringify(queryKey) */
  key: string;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  dataUndefined: boolean;
  enabled?: boolean;
};

export type UseScreenLoadTraceOptions = {
  screen: string;
  /** Remount trace when route identity changes (handle, search q, etc.) */
  routeKey: string;
  showSkeleton: boolean;
  showContent: boolean;
  branch: string;
  queries: ScreenLoadQueryTrace[];
  extra?: Record<string, unknown>;
};

/**
 * Dev-only timeline: SCREEN_MOUNT → FIRST_RENDER → QUERY_START → SKELETON_RENDER → DATA_RECEIVED → CONTENT_RENDER
 */
export function useScreenLoadTrace({
  screen,
  routeKey,
  showSkeleton,
  showContent,
  branch,
  queries,
  extra,
}: UseScreenLoadTraceOptions): void {
  const firstRenderLogged = useRef(false);

  useEffect(() => {
    resetScreenLoadTrace(screen, { routeKey });
    firstRenderLogged.current = false;
    return () => {
      clearScreenLoadTrace(screen);
    };
  }, [screen, routeKey]);

  useLayoutEffect(() => {
    if (firstRenderLogged.current) return;
    firstRenderLogged.current = true;
    logScreenLoadTrace(screen, 'FIRST_RENDER', {
      routeKey,
      branch,
      showSkeleton,
      showContent,
      queries: queries.map((q) => ({
        key: q.key,
        enabled: q.enabled ?? true,
        isPending: q.isPending,
        isFetching: q.isFetching,
        dataUndefined: q.dataUndefined,
      })),
      ...extra,
    });
  });

  useEffect(() => {
    for (const q of queries) {
      if (q.enabled === false) continue;
      if (q.isPending || q.isFetching) {
        logScreenLoadTraceOnce(screen, 'QUERY_START', q.key, {
          routeKey,
          queryKey: q.key,
          isPending: q.isPending,
          isFetching: q.isFetching,
          dataUndefined: q.dataUndefined,
        });
      }
      if (!q.dataUndefined && !q.isPending) {
        logScreenLoadTraceOnce(screen, 'DATA_RECEIVED', q.key, {
          routeKey,
          queryKey: q.key,
          isError: q.isError,
        });
      }
    }
  }, [screen, routeKey, queries]);

  useEffect(() => {
    if (!showSkeleton) return;
    logScreenLoadTraceOnce(screen, 'SKELETON_RENDER', 'skeleton', { routeKey, branch });
  }, [screen, routeKey, showSkeleton, branch]);

  useEffect(() => {
    if (!showContent) return;
    logScreenLoadTraceOnce(screen, 'CONTENT_RENDER', 'content', { routeKey, branch });
  }, [screen, routeKey, showContent, branch]);
}
