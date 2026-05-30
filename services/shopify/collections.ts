import { ALL_PRODUCTS_COLLECTION_HANDLE } from '@/constants/catalog';
import type { Collection, Product } from '@/types/shopify';
import { getKokobayWebCollections } from '@/services/kokobay-web/collections-catalog';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import {
  fetchKokobayCollectionPage,
  fetchKokobayProductsPage,
  fetchKokobayProductsUpTo,
} from '@/services/kokobay-web/storefront-catalog';
import { resolveCollectionHandleForApi } from '@/utils/collection-handles';
import { orderCollectionsForDisplay } from '@/utils/order-collections';

import { fetchShopify } from './client';
import { GET_COLLECTIONS, GET_COLLECTION_WITH_PRODUCTS } from './queries';
import { normalizeProduct, searchProducts, type StorefrontProductNode } from './products';

const ALL_PRODUCTS_SHOPIFY_FIRST = 250;

type GqlImage = {
  id?: string | null;
  url?: string | null;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
} | null;

type GqlCollectionNode = {
  id: string;
  handle: string;
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  image?: GqlImage;
};

function normalizeCollection(node: GqlCollectionNode | null | undefined): Collection | null {
  if (!node?.id || !node.handle) {
    return null;
  }
  let image: Collection['image'] = null;
  if (node.image?.url) {
    image = {
      id: node.image.id ?? undefined,
      url: node.image.url,
      altText: node.image.altText ?? null,
      width: node.image.width ?? null,
      height: node.image.height ?? null,
    };
  }
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description ?? undefined,
    descriptionHtml: node.descriptionHtml ?? undefined,
    image,
  };
}

type CollectionsData = {
  collections: { edges: { node: GqlCollectionNode }[] } | null;
};

type CollectionProductsData = {
  collection: (GqlCollectionNode & {
    products?: { edges: { node: StorefrontProductNode }[] } | null;
  }) | null;
};

/**
 * Storefront collections list from Koko Bay web API or Shopify Storefront.
 * Returns an empty list when unavailable.
 */
export async function getCollections(first = 24): Promise<Collection[]> {
  const web = isKokobayWebProductsConfigured();

  if (web) {
    const fromApi = await getKokobayWebCollections(Math.max(first, 250));
    if (fromApi?.length) {
      const list = orderCollectionsForDisplay(fromApi);
      return list.slice(0, first);
    }
    return [];
  }

  try {
    const data = await fetchShopify<CollectionsData>(GET_COLLECTIONS, { first });
    const edges = data?.collections?.edges;
    if (!edges?.length) {
      return [];
    }
    const mapped = edges
      .map((e) => normalizeCollection(e.node))
      .filter((c): c is Collection => c !== null);
    return orderCollectionsForDisplay(mapped).slice(0, first);
  } catch {
    return [];
  }
}

/**
 * Products belonging to a collection handle from Koko Bay or Storefront.
 * Returns an empty list when unavailable.
 */
export async function getCollectionProducts(handle: string, first = 24): Promise<Product[]> {
  const safeHandle = handle?.trim();
  if (!safeHandle) {
    return [];
  }

  if (safeHandle === ALL_PRODUCTS_COLLECTION_HANDLE) {
    const effectiveFirst = Math.max(first, ALL_PRODUCTS_SHOPIFY_FIRST);
    if (isKokobayWebProductsConfigured()) {
      return fetchKokobayProductsUpTo(effectiveFirst, (after) =>
        fetchKokobayProductsPage({ after }),
      );
    }
    try {
      return await searchProducts('*', effectiveFirst);
    } catch {
      return [];
    }
  }

  if (isKokobayWebProductsConfigured()) {
    const apiHandle = resolveCollectionHandleForApi(safeHandle);
    return fetchKokobayProductsUpTo(first, (after) =>
      fetchKokobayCollectionPage(apiHandle, { after }).then((page) =>
        page ? { items: page.items, pageInfo: page.pageInfo } : null,
      ),
    );
  }

  try {
    const data = await fetchShopify<CollectionProductsData>(GET_COLLECTION_WITH_PRODUCTS, {
      handle: safeHandle,
      first,
    });
    const collection = data?.collection;
    if (!collection?.products?.edges?.length) {
      return [];
    }
    return collection.products.edges
      .map((e) => normalizeProduct(e.node))
      .filter((p): p is Product => p !== null);
  } catch {
    return [];
  }
}
