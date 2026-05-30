import type { Collection, Product } from '@/types/shopify';
import type { PlpFilters, PlpSort } from '@/types/plp';
import {
  appendPlpFiltersToSearchParams,
  parseStorefrontFilters,
  plpSortToCollectionSortParam,
  plpSortToSearchSortParam,
} from '@/utils/storefront-filters';

import { fetchKokobayJson, isKokobayWebProductsConfigured } from './client';
import {
  buildPaginatedQuery,
  KOKOBAY_CATALOG_PAGE_SIZE,
  parsePageInfo,
  type KokobayPaginatedResult,
} from './pagination';
import {
  storefrontCollectionSummaryToCollection,
  storefrontProductPreviewToProduct,
  storefrontProductToProduct,
} from './storefront-mappers';
import type {
  KokobayCollectionProductsJson,
  KokobayPaginatedProductsJson,
  KokobayProductDetailJson,
  KokobaySearchJson,
  KokobayStorefrontFilter,
  KokobayStorefrontProductPreview,
} from './storefront-types';

function isErrorPayload(data: Record<string, unknown>): boolean {
  return typeof data.error === 'string';
}

function mapPreviewRows(raw: unknown): Product[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => storefrontProductPreviewToProduct(row as KokobayStorefrontProductPreview))
    .filter((p): p is Product => p !== null);
}

function parsePaginatedPreviews(
  data: Record<string, unknown> | null,
): (KokobayPaginatedResult<Product> & { totalCount?: number }) | null {
  if (!data || isErrorPayload(data)) return null;
  const body = data as unknown as KokobayPaginatedProductsJson;
  if (!Array.isArray(body.products)) return null;
  return {
    items: mapPreviewRows(body.products),
    pageInfo: parsePageInfo(body.pagination),
    totalCount: typeof body.totalCount === 'number' ? body.totalCount : undefined,
  };
}

export type FetchKokobayProductsPageOptions = {
  first?: number;
  after?: string | null;
};

/** `GET /api/products?first=&after=` — slim paginated catalog. */
export type KokobayProductsPage = KokobayPaginatedResult<Product> & { totalCount?: number };

export async function fetchKokobayProductsPage(
  options: FetchKokobayProductsPageOptions = {},
): Promise<KokobayProductsPage | null> {
  if (!isKokobayWebProductsConfigured()) return null;
  const first = options.first ?? KOKOBAY_CATALOG_PAGE_SIZE;
  const params = buildPaginatedQuery({ first, after: options.after });
  const data = await fetchKokobayJson(`/api/products?${params.toString()}`);
  return parsePaginatedPreviews(data);
}

/** `GET /api/products/{handle}` — full PDP payload. */
export async function fetchKokobayProductByHandle(
  handle: string,
  options?: { signal?: AbortSignal },
): Promise<Product | null> {
  if (!isKokobayWebProductsConfigured()) return null;
  const safe = handle.trim();
  if (!safe) return null;
  const data = await fetchKokobayJson(`/api/products/${encodeURIComponent(safe)}`, options);
  if (!data || isErrorPayload(data)) return null;
  const body = data as unknown as KokobayProductDetailJson;
  return storefrontProductToProduct(body.product);
}

export type FetchKokobayCollectionPageOptions = {
  first?: number;
  after?: string | null;
  plpFilters?: PlpFilters;
  sort?: PlpSort;
  /** Facet metadata from a prior response — used to map chip labels to Shopify filter inputs. */
  storefrontFilters?: KokobayStorefrontFilter[];
};

export type KokobayCollectionPage = KokobayPaginatedResult<Product> & {
  collection: Collection | null;
  filters: KokobayStorefrontFilter[];
  totalCount?: number;
};

function appendCollectionQueryOptions(
  params: URLSearchParams,
  options: FetchKokobayCollectionPageOptions,
): void {
  if (options.sort) {
    params.set('sort', plpSortToCollectionSortParam(options.sort));
  }
  if (options.plpFilters && options.storefrontFilters?.length) {
    appendPlpFiltersToSearchParams(params, options.plpFilters, options.storefrontFilters);
  }
}

/** `GET /api/collections/{handle}?first=&after=` — slim collection grid. */
export async function fetchKokobayCollectionPage(
  handle: string,
  options: FetchKokobayCollectionPageOptions = {},
): Promise<KokobayCollectionPage | null> {
  if (!isKokobayWebProductsConfigured()) return null;
  const safe = handle.trim();
  if (!safe) return null;
  const first = options.first ?? KOKOBAY_CATALOG_PAGE_SIZE;
  const params = buildPaginatedQuery({ first, after: options.after });
  appendCollectionQueryOptions(params, options);
  const data = await fetchKokobayJson(
    `/api/collections/${encodeURIComponent(safe)}?${params.toString()}`,
  );
  if (!data || isErrorPayload(data)) return null;
  const body = data as unknown as KokobayCollectionProductsJson;
  if (!Array.isArray(body.products)) return null;
  const collection = storefrontCollectionSummaryToCollection(
    body.collection
      ? {
          id: body.collection.id,
          handle: body.collection.handle,
          title: body.collection.title,
          image: body.collection.image ?? null,
        }
      : null,
  );
  return {
    collection,
    items: mapPreviewRows(body.products),
    pageInfo: parsePageInfo(body.pagination),
    filters: parseStorefrontFilters(body.filters),
    totalCount: typeof body.totalCount === 'number' ? body.totalCount : undefined,
  };
}

export type FetchKokobaySearchPageOptions = {
  first?: number;
  after?: string | null;
  plpFilters?: PlpFilters;
  sort?: PlpSort;
  storefrontFilters?: KokobayStorefrontFilter[];
};

export type KokobaySearchPage = KokobayPaginatedResult<Product> & {
  filters: KokobayStorefrontFilter[];
  totalCount?: number;
};

/** `GET /api/search?q=&first=&after=` — slim search results. */
export async function fetchKokobaySearchPage(
  query: string,
  options: FetchKokobaySearchPageOptions = {},
): Promise<KokobaySearchPage | null> {
  if (!isKokobayWebProductsConfigured()) return null;
  const q = query.trim();
  if (!q) return null;
  const first = options.first ?? KOKOBAY_CATALOG_PAGE_SIZE;
  const params = buildPaginatedQuery({ first, after: options.after, q });
  if (options.sort) {
    params.set('sort', plpSortToSearchSortParam(options.sort));
  }
  if (options.plpFilters && options.storefrontFilters?.length) {
    appendPlpFiltersToSearchParams(params, options.plpFilters, options.storefrontFilters);
  }
  const data = await fetchKokobayJson(`/api/search?${params.toString()}`);
  if (!data || isErrorPayload(data)) return null;
  const body = data as unknown as KokobaySearchJson;
  if (!Array.isArray(body.products)) return null;
  const rawFilters = body.productFilters ?? body.filters;
  return {
    items: mapPreviewRows(body.products),
    pageInfo: parsePageInfo(body.pagination),
    filters: parseStorefrontFilters(rawFilters),
    totalCount: typeof body.totalCount === 'number' ? body.totalCount : undefined,
  };
}

async function fetchProductFeed(path: string, first: number): Promise<Product[]> {
  const data = await fetchKokobayJson(`${path}?first=${Math.max(1, first)}`);
  const page = parsePaginatedPreviews(data);
  return page?.items ?? [];
}

/** `GET /api/products?sort=created` — newest products first. */
export async function fetchKokobayLatestProducts(first = 12): Promise<Product[]> {
  if (!isKokobayWebProductsConfigured()) return [];
  const params = buildPaginatedQuery({ first: Math.max(1, first) });
  params.set('sort', 'created');
  const data = await fetchKokobayJson(`/api/products?${params.toString()}`);
  const page = parsePaginatedPreviews(data);
  return page?.items ?? [];
}

/** `GET /api/products/featured` */
export async function fetchKokobayFeaturedProducts(first = 12): Promise<Product[]> {
  if (!isKokobayWebProductsConfigured()) return [];
  return fetchProductFeed('/api/products/featured', first);
}

/** `GET /api/products/trending` */
export async function fetchKokobayTrendingProducts(first = 12): Promise<Product[]> {
  if (!isKokobayWebProductsConfigured()) return [];
  return fetchProductFeed('/api/products/trending', first);
}

/** Fetches additional pages until `maxItems` or no next page (avoid for large caps). */
export async function fetchKokobayProductsUpTo(
  maxItems: number,
  fetchPage: (after: string | null) => Promise<KokobayPaginatedResult<Product> | null>,
): Promise<Product[]> {
  const target = Math.max(1, maxItems);
  const collected: Product[] = [];
  let after: string | null = null;

  while (collected.length < target) {
    const page = await fetchPage(after);
    if (!page?.items.length) break;
    collected.push(...page.items);
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    after = page.pageInfo.endCursor;
  }

  return collected.slice(0, target);
}
