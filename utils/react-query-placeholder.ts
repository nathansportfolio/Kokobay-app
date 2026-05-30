import type { InfiniteData, Query } from '@tanstack/react-query';

/**
 * Like `keepPreviousData`, but only when a specific query-key segment matches.
 * Prevents collection A's products showing while collection B loads; still smooth for filter/sort changes.
 */
export function keepPreviousDataForQueryKeyMatch<
  TData,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  queryKeyIndex: number,
  identity: unknown,
) {
  return (
    previousData: TData | undefined,
    previousQuery: Query<TData, Error, TData, TQueryKey> | undefined,
  ): TData | undefined => {
    if (previousQuery?.queryKey[queryKeyIndex] === identity && previousData !== undefined) {
      return previousData;
    }
    return undefined;
  };
}

/** Infinite-query variant — keeps prior pages while filters/sort change within the same collection/search. */
export function keepPreviousInfiniteDataForQueryKeyMatch<
  TPage,
  TPageParam = unknown,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  queryKeyIndex: number,
  identity: unknown,
) {
  return (
    previousData: InfiniteData<TPage, TPageParam> | undefined,
    previousQuery:
      | Query<InfiniteData<TPage, TPageParam>, Error, InfiniteData<TPage, TPageParam>, TQueryKey>
      | undefined,
  ): InfiniteData<TPage, TPageParam> | undefined => {
    if (previousQuery?.queryKey[queryKeyIndex] === identity && previousData !== undefined) {
      return previousData;
    }
    return undefined;
  };
}
