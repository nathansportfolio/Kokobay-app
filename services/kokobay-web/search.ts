import type { Collection, Product } from '@/types/shopify';

import { fetchKokobayJson, isKokobayWebProductsConfigured } from './client';
import { fetchKokobaySearchPage } from './storefront-catalog';
import {
  storefrontCollectionSummaryToCollection,
  storefrontProductPreviewToProduct,
} from './storefront-mappers';
import type { KokobayPredictiveSearchJson } from './storefront-types';

const SEARCH_PAGE_MAX = 50;

function isSearchErrorPayload(data: Record<string, unknown>): boolean {
  return typeof data.error === 'string';
}

/**
 * `GET /api/search` — fetches up to `desiredCount` products (cursor pagination, max 50 per request).
 */
export async function fetchKokobaySearchProducts(
  query: string,
  desiredCount: number,
): Promise<Product[] | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const q = query.trim();
  if (!q) return null;

  const target = Math.max(1, desiredCount);
  const collected: Product[] = [];
  let after: string | undefined;

  while (collected.length < target) {
    const first = Math.min(SEARCH_PAGE_MAX, target - collected.length);
    const page = await fetchKokobaySearchPage(q, { first, after });
    if (!page) {
      return collected.length > 0 ? collected : null;
    }

    collected.push(...page.items);

    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor || page.items.length === 0) {
      break;
    }
    after = page.pageInfo.endCursor;
  }

  return collected;
}

export type KokobayPredictiveSearchResult = {
  query: string;
  products: Product[];
  collections: Collection[];
  suggestions: string[];
};

/**
 * `GET /api/search/predictive` — type-ahead products, collections, and query suggestions (min 2 chars).
 */
export async function fetchKokobayPredictiveSearch(
  query: string,
  limit = 8,
): Promise<KokobayPredictiveSearchResult | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const q = query.trim();
  if (q.length < 2) return null;

  const boundedLimit = Math.min(10, Math.max(1, limit));
  const params = new URLSearchParams({ q, limit: String(boundedLimit) });
  const data = await fetchKokobayJson(`/api/search/predictive?${params.toString()}`);
  if (!data || isSearchErrorPayload(data)) return null;

  const body = data as unknown as KokobayPredictiveSearchJson;
  const products = (body.products ?? [])
    .map((p) => storefrontProductPreviewToProduct(p))
    .filter((p): p is Product => p !== null);
  const collections = (body.collections ?? [])
    .map((c) => storefrontCollectionSummaryToCollection(c))
    .filter((c): c is Collection => c !== null);
  const suggestions = (body.suggestions ?? [])
    .map((s) => s.text?.trim())
    .filter((t): t is string => Boolean(t));

  return { query: body.query ?? q, products, collections, suggestions };
}
