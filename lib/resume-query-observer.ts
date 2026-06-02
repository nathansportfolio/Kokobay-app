import type { Query, QueryCacheNotifyEvent, QueryClient } from '@tanstack/react-query';

import {
  logResumeQueryRefetchComplete,
  logResumeQueryRefetchStarted,
} from '@/lib/resume-perf';

function estimateResponseBytes(data: unknown): number | undefined {
  if (data === undefined) return undefined;
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length;
  } catch {
    return undefined;
  }
}

function queryKeyLabel(query: Query): unknown {
  return query.queryKey;
}

const refetchStartedAt = new WeakMap<Query, number>();

/** Subscribe to React Query cache updates and log refetches during resume (dev only). */
export function installResumeQueryObserver(queryClient: QueryClient): () => void {
  if (!__DEV__) return () => {};

  return queryClient.getQueryCache().subscribe((event: QueryCacheNotifyEvent) => {
    const query = event.query;
    if (!query) return;

    if (event.type === 'updated' && query.state.fetchStatus === 'fetching') {
      if (!refetchStartedAt.has(query)) {
        refetchStartedAt.set(query, performance.now());
        logResumeQueryRefetchStarted(queryKeyLabel(query));
      }
      return;
    }

    if (
      event.type === 'updated' &&
      query.state.fetchStatus === 'idle' &&
      refetchStartedAt.has(query)
    ) {
      const start = refetchStartedAt.get(query)!;
      refetchStartedAt.delete(query);
      const durationMs = Math.round(performance.now() - start);
      logResumeQueryRefetchComplete(
        queryKeyLabel(query),
        durationMs,
        estimateResponseBytes(query.state.data),
      );
    }
  });
}
