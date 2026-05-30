import type { KokobayStorefrontPageInfo } from './storefront-types';

export type KokobayPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export type KokobayPaginatedResult<T> = {
  items: T[];
  pageInfo: KokobayPageInfo;
};

export const KOKOBAY_CATALOG_PAGE_SIZE = 24;

export function parsePageInfo(raw: unknown): KokobayPageInfo {
  const pageInfo = (raw as { pageInfo?: KokobayStorefrontPageInfo } | null)?.pageInfo;
  return {
    hasNextPage: pageInfo?.hasNextPage ?? false,
    hasPreviousPage: pageInfo?.hasPreviousPage ?? false,
    startCursor: pageInfo?.startCursor ?? null,
    endCursor: pageInfo?.endCursor ?? null,
  };
}

export function buildPaginatedQuery(params: {
  first: number;
  after?: string | null;
  q?: string;
}): URLSearchParams {
  const search = new URLSearchParams({ first: String(Math.max(1, params.first)) });
  if (params.after) search.set('after', params.after);
  if (params.q?.trim()) search.set('q', params.q.trim());
  return search;
}
