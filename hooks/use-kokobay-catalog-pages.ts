import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ALL_PRODUCTS_COLLECTION_HANDLE } from '@/constants/catalog';
import {
  KOKOBAY_CATALOG_GC_TIME_MS,
  KOKOBAY_CATALOG_MAX_PAGES,
} from '@/constants/kokobay-catalog-query';
import { useMarketQueryKey } from '@/hooks/use-market-query-key';
import type { KokobayPageInfo } from '@/services/kokobay-web/pagination';
import { KOKOBAY_CATALOG_PAGE_SIZE } from '@/services/kokobay-web/pagination';
import type { KokobayCollectionPage, KokobaySearchPage } from '@/services/kokobay-web/storefront-catalog';
import type { KokobayStorefrontFilter } from '@/services/kokobay-web/storefront-types';
import {
  fetchKokobayCollectionPage,
  fetchKokobayProductsPage,
  fetchKokobaySearchPage,
} from '@/services/kokobay-web/storefront-catalog';
import type { PlpFilters, PlpSort } from '@/types/plp';
import type { Collection, Product } from '@/types/shopify';
import { resolveCollectionHandleForApi } from '@/utils/collection-handles';
import { flattenCatalogProductPages } from '@/utils/kokobay-catalog-products';
import { keepPreviousInfiniteDataForQueryKeyMatch } from '@/utils/react-query-placeholder';
import {
  canApplyStorefrontPlpFilters,
  facetsFromStorefrontFilters,
  hasActivePlpFilters,
  storefrontFilterPriceMeta,
  type StorefrontFilterFacets,
} from '@/utils/storefront-filters';

const EMPTY_FACETS: StorefrontFilterFacets = {
  sizes: [],
  categories: [],
  colourGroups: [],
  sizeCounts: {},
  categoryCounts: {},
  colourGroupCounts: {},
  priceMin: 0,
  priceMax: 0,
};

const EMPTY_PAGE_INFO: KokobayPageInfo = {
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
  endCursor: null,
};

export type CatalogPage = {
  products: Product[];
  pageInfo: KokobayPageInfo;
  filters: KokobayStorefrontFilter[];
  totalCount?: number;
  /** Collection summary from `GET /api/collections/{handle}` (first page only). */
  collection?: Collection | null;
};

type KokobayCatalogOptions = {
  plpFilters: PlpFilters;
  sort: PlpSort;
};

type CollectionCatalogQueryKey = readonly [
  'kokobay',
  'collection-products',
  string,
  string,
  PlpFilters,
  PlpSort,
];

type SearchCatalogQueryKey = readonly [
  'kokobay',
  'search-products',
  string,
  string,
  PlpFilters,
  PlpSort,
];

type CatalogInfiniteData = InfiniteData<CatalogPage, string | null>;

const kokobayCatalogInfiniteDefaults = {
  maxPages: KOKOBAY_CATALOG_MAX_PAGES,
  gcTime: KOKOBAY_CATALOG_GC_TIME_MS,
  initialPageParam: null as string | null,
} as const;

function useStableFilterFacets(storefrontFilters: KokobayStorefrontFilter[], resetKey: string) {
  const stableFacetsRef = useRef<StorefrontFilterFacets>(EMPTY_FACETS);

  useEffect(() => {
    stableFacetsRef.current = EMPTY_FACETS;
  }, [resetKey]);

  return useMemo(() => {
    if (storefrontFilters.length > 0) {
      const next = facetsFromStorefrontFilters(storefrontFilters);
      stableFacetsRef.current = next;
      return next;
    }
    return stableFacetsRef.current;
  }, [storefrontFilters]);
}

/** Keeps full filter metadata from the first unfiltered load for chip UI + API lookups. */
function useStorefrontFilterRefs(resetKey: string) {
  const latestFiltersRef = useRef<KokobayStorefrontFilter[]>([]);
  const baselineFiltersRef = useRef<KokobayStorefrontFilter[]>([]);
  /** Fallback when React Query serves cached pages without re-running `queryFn`. */
  const pageFiltersRef = useRef<KokobayStorefrontFilter[]>([]);

  useEffect(() => {
    latestFiltersRef.current = [];
    baselineFiltersRef.current = [];
    pageFiltersRef.current = [];
  }, [resetKey]);

  const rememberFilters = useCallback(
    (filters: KokobayStorefrontFilter[], plpFilters: PlpFilters) => {
      if (!filters.length) return;
      latestFiltersRef.current = filters;
      pageFiltersRef.current = filters;
      if (!hasActivePlpFilters(plpFilters, 0, 0)) {
        baselineFiltersRef.current = filters;
        return;
      }
      if (!baselineFiltersRef.current.length) {
        baselineFiltersRef.current = filters;
      }
    },
    [],
  );

  const filtersForLookup = useCallback(() => {
    if (baselineFiltersRef.current.length > 0) return baselineFiltersRef.current;
    if (latestFiltersRef.current.length > 0) return latestFiltersRef.current;
    return pageFiltersRef.current;
  }, []);

  return { rememberFilters, filtersForLookup, baselineFiltersRef, pageFiltersRef };
}

/** `totalCount` usually arrives on page 1 — retain after `maxPages` drops the oldest page. */
function useRetainedTotalCount(
  pages: readonly CatalogPage[] | undefined,
  resetKey: string,
): number | undefined {
  const retainedRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    retainedRef.current = undefined;
  }, [resetKey]);

  return useMemo(() => {
    for (const page of pages ?? []) {
      if (typeof page.totalCount === 'number') {
        retainedRef.current = page.totalCount;
        return page.totalCount;
      }
    }
    return retainedRef.current;
  }, [pages]);
}

function storefrontFiltersFromPages(
  pages: readonly CatalogPage[] | undefined,
): KokobayStorefrontFilter[] {
  if (!pages?.length) return [];
  return pages.find((page) => page.filters.length > 0)?.filters ?? [];
}

function catalogPageFromCollection(page: KokobayCollectionPage): CatalogPage {
  return {
    products: page.items,
    pageInfo: page.pageInfo,
    filters: page.filters,
    totalCount: page.totalCount,
    collection: page.collection,
  };
}

function catalogPageFromSearch(page: KokobaySearchPage): CatalogPage {
  return {
    products: page.items,
    pageInfo: page.pageInfo,
    filters: page.filters,
    totalCount: page.totalCount,
  };
}

export function useKokobayCollectionCatalog(
  handle: string,
  enabled: boolean,
  options: KokobayCatalogOptions,
) {
  const apiHandle = resolveCollectionHandleForApi(handle.trim());
  const marketKey = useMarketQueryKey();
  const { rememberFilters, filtersForLookup, baselineFiltersRef, pageFiltersRef } =
    useStorefrontFilterRefs(apiHandle);

  const queryKey = [
    'kokobay',
    'collection-products',
    apiHandle,
    marketKey,
    options.plpFilters,
    options.sort,
  ] as CollectionCatalogQueryKey;

  const query = useInfiniteQuery<
    CatalogPage,
    Error,
    CatalogInfiniteData,
    CollectionCatalogQueryKey,
    string | null
  >({
    ...kokobayCatalogInfiniteDefaults,
    queryKey,
    enabled: enabled && Boolean(apiHandle),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousInfiniteDataForQueryKeyMatch<
      CatalogPage,
      string | null,
      CollectionCatalogQueryKey
    >(2, apiHandle),
    queryFn: async ({ pageParam }): Promise<CatalogPage> => {
      const safe = apiHandle;
      if (safe === ALL_PRODUCTS_COLLECTION_HANDLE) {
        const page = await fetchKokobayProductsPage({
          first: KOKOBAY_CATALOG_PAGE_SIZE,
          after: pageParam,
        });
        return {
          products: page.items,
          pageInfo: page.pageInfo,
          filters: [],
          totalCount: page.totalCount,
        };
      }
      const page = await fetchKokobayCollectionPage(safe, {
        first: KOKOBAY_CATALOG_PAGE_SIZE,
        after: pageParam,
        plpFilters: options.plpFilters,
        sort: options.sort,
        storefrontFilters: filtersForLookup(),
      });
      if (page.filters.length) {
        rememberFilters(page.filters, options.plpFilters);
      }
      return catalogPageFromCollection(page);
    },
    getNextPageParam: (last) =>
      last.pageInfo.hasNextPage && last.pageInfo.endCursor ? last.pageInfo.endCursor : undefined,
  });

  const pages = query.data?.pages;
  const products = useMemo(() => flattenCatalogProductPages(pages), [pages]);
  const collectionSummary = useMemo(
    () => pages?.find((page) => page.collection)?.collection ?? null,
    [pages],
  );
  const totalCountResetKey = `${apiHandle}:${marketKey}:${options.sort}:${JSON.stringify(options.plpFilters)}`;
  const totalProductCount = useRetainedTotalCount(pages, totalCountResetKey);
  const storefrontFilters = useMemo(() => storefrontFiltersFromPages(pages), [pages]);

  useEffect(() => {
    if (!storefrontFilters.length) return;
    pageFiltersRef.current = storefrontFilters;
    rememberFilters(storefrontFilters, options.plpFilters);
  }, [storefrontFilters, options.plpFilters, rememberFilters]);

  const facetSourceFilters = useMemo(() => {
    if (baselineFiltersRef.current.length > 0) {
      return baselineFiltersRef.current;
    }
    return storefrontFilters;
  }, [storefrontFilters, query.dataUpdatedAt]);
  const filterFacets = useStableFilterFacets(facetSourceFilters, apiHandle);
  const serverSideFiltersCapable = canApplyStorefrontPlpFilters(facetSourceFilters);

  return {
    ...query,
    products,
    collectionSummary,
    storefrontFilters,
    filterFacets,
    totalProductCount,
    serverSideFiltersCapable,
  };
}

export function useKokobaySearchCatalog(
  queryText: string,
  enabled: boolean,
  options: KokobayCatalogOptions,
) {
  const trimmed = queryText.trim();
  const marketKey = useMarketQueryKey();
  const { rememberFilters, filtersForLookup, baselineFiltersRef, pageFiltersRef } =
    useStorefrontFilterRefs(trimmed);

  const queryKey = [
    'kokobay',
    'search-products',
    trimmed,
    marketKey,
    options.plpFilters,
    options.sort,
  ] as SearchCatalogQueryKey;

  const query = useInfiniteQuery<
    CatalogPage,
    Error,
    CatalogInfiniteData,
    SearchCatalogQueryKey,
    string | null
  >({
    ...kokobayCatalogInfiniteDefaults,
    queryKey,
    enabled: enabled && trimmed.length >= 1,
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousInfiniteDataForQueryKeyMatch<
      CatalogPage,
      string | null,
      SearchCatalogQueryKey
    >(2, trimmed),
    queryFn: async ({ pageParam }): Promise<CatalogPage> => {
      const page = await fetchKokobaySearchPage(trimmed, {
        first: KOKOBAY_CATALOG_PAGE_SIZE,
        after: pageParam,
        plpFilters: options.plpFilters,
        sort: options.sort,
        storefrontFilters: filtersForLookup(),
      });
      if (page.filters.length) {
        rememberFilters(page.filters, options.plpFilters);
      }
      return catalogPageFromSearch(page);
    },
    getNextPageParam: (last) =>
      last.pageInfo.hasNextPage && last.pageInfo.endCursor ? last.pageInfo.endCursor : undefined,
  });

  const pages = query.data?.pages;
  const products = useMemo(() => flattenCatalogProductPages(pages), [pages]);
  const totalCountResetKey = `${trimmed}:${marketKey}:${options.sort}:${JSON.stringify(options.plpFilters)}`;
  const totalProductCount = useRetainedTotalCount(pages, totalCountResetKey);
  const storefrontFilters = useMemo(() => storefrontFiltersFromPages(pages), [pages]);

  useEffect(() => {
    if (!storefrontFilters.length) return;
    pageFiltersRef.current = storefrontFilters;
    rememberFilters(storefrontFilters, options.plpFilters);
  }, [storefrontFilters, options.plpFilters, rememberFilters]);

  const facetSourceFilters = useMemo(() => {
    if (baselineFiltersRef.current.length > 0) {
      return baselineFiltersRef.current;
    }
    return storefrontFilters;
  }, [storefrontFilters, query.dataUpdatedAt]);
  const filterFacets = useStableFilterFacets(facetSourceFilters, trimmed);
  const serverSideFiltersCapable = canApplyStorefrontPlpFilters(facetSourceFilters);

  return {
    ...query,
    products,
    storefrontFilters,
    filterFacets,
    totalProductCount,
    serverSideFiltersCapable,
  };
}

export { storefrontFilterPriceMeta };
