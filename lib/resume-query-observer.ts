import type { Query, QueryCacheNotifyEvent, QueryClient } from '@tanstack/react-query';

import {
  isForegroundAuditEnabled,
  isForegroundAuditWindowActive,
  recordForegroundAuditQuery,
} from '@/lib/foreground-audit';
import {
  isJsFreezeAuditEnabled,
  isJsFreezeSessionActive,
  markJsFreezeTimeline,
  traceLongTask,
} from '@/lib/js-freeze-audit';
import {
  isResumePerfEnabled,
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

function queryKeyString(query: Query): string {
  try {
    return JSON.stringify(query.queryKey);
  } catch {
    return String(query.queryKey);
  }
}

const refetchStartedAt = new WeakMap<Query, number>();

function queryRefetchReason(query: Query, event: QueryCacheNotifyEvent): string {
  const actionType =
    event.type === 'updated' &&
    'action' in event &&
    event.action &&
    typeof event.action === 'object' &&
    'type' in event.action
      ? String((event.action as { type?: string }).type)
      : undefined;
  if (actionType) return actionType;
  if (query.state.isInvalidated) return 'invalidated';
  if (query.state.fetchStatus === 'fetching') return 'fetch';
  return 'unknown';
}

function handleQueryCacheEvent(event: QueryCacheNotifyEvent): void {
  const query = event.query;
  if (!query) return;

  if (event.type === 'updated' && query.state.fetchStatus === 'fetching') {
    if (!refetchStartedAt.has(query)) {
      refetchStartedAt.set(query, performance.now());
      logResumeQueryRefetchStarted(queryKeyLabel(query));
      if (isJsFreezeAuditEnabled() && isJsFreezeSessionActive()) {
        markJsFreezeTimeline('query_refetch_start', { key: queryKeyString(query) });
      }
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
    const key = queryKeyLabel(query);
    const reason = queryRefetchReason(query, event);
    logResumeQueryRefetchComplete(
      key,
      durationMs,
      estimateResponseBytes(query.state.data),
    );
    if (isForegroundAuditEnabled() && isForegroundAuditWindowActive()) {
      recordForegroundAuditQuery(key, durationMs, reason);
    }
    if (isJsFreezeAuditEnabled() && isJsFreezeSessionActive()) {
      markJsFreezeTimeline('query_refetch_end', {
        key: queryKeyString(query),
        duration_ms: durationMs,
        reason,
      });
    }
  }
}

/** Subscribe to React Query cache updates and log refetches during resume (dev only). */
export function installResumeQueryObserver(queryClient: QueryClient): () => void {
  if (!__DEV__ || !isResumePerfEnabled()) return () => {};

  return queryClient.getQueryCache().subscribe((event: QueryCacheNotifyEvent) => {
    if (isJsFreezeAuditEnabled() && isJsFreezeSessionActive()) {
      traceLongTask(`react-query.cache:${event.type}`, () => {
        handleQueryCacheEvent(event);
      });
      return;
    }
    handleQueryCacheEvent(event);
  });
}
