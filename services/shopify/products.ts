import type { Image, Money, Product, ProductVariant } from '@/types/shopify';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { fetchKokobayProductByHandle, fetchKokobayProductsPage } from '@/services/kokobay-web/storefront-catalog';
import { fetchKokobaySearchProducts } from '@/services/kokobay-web/search';

import { fetchShopify, isShopifyConfigured } from './client';
import { GET_PRODUCT_BY_HANDLE, LIST_PRODUCTS_NEWEST_FIRST, SEARCH_PRODUCTS } from './queries';

type GqlMoney = { amount: string; currencyCode: string } | null | undefined;

type GqlImage = {
  id?: string | null;
  url?: string | null;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
} | null;

type GqlVariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: GqlMoney;
  compareAtPrice?: GqlMoney;
  selectedOptions: { name: string; value: string }[];
  image?: GqlImage;
};

export type StorefrontProductNode = {
  id: string;
  handle: string;
  title: string;
  description?: string | null;
  descriptionHtml?: string | null;
  availableForSale: boolean;
  vendor?: string | null;
  productType?: string | null;
  tags: string[];
  images?: { edges?: { node: GqlImage }[] | null } | null;
  variants?: { edges?: { node: GqlVariantNode }[] | null } | null;
  priceRange: {
    minVariantPrice: GqlMoney;
    maxVariantPrice: GqlMoney;
  };
};

function normalizeMoney(m: GqlMoney): Money {
  return {
    amount: m?.amount ?? '0',
    currencyCode: m?.currencyCode ?? 'GBP',
  };
}

function normalizeImage(node: GqlImage): Image | null {
  if (!node?.url) {
    return null;
  }
  return {
    id: node.id ?? undefined,
    url: node.url,
    altText: node.altText ?? null,
    width: node.width ?? null,
    height: node.height ?? null,
  };
}

function normalizeVariant(node: GqlVariantNode): ProductVariant {
  return {
    id: node.id,
    title: node.title,
    availableForSale: node.availableForSale,
    price: normalizeMoney(node.price),
    compareAtPrice: node.compareAtPrice ? normalizeMoney(node.compareAtPrice) : null,
    selectedOptions: node.selectedOptions ?? [],
    image: normalizeImage(node.image ?? null),
  };
}

/** Exported for `collections.ts` — maps a Storefront `Product` node to our `Product` type. */
export function normalizeProduct(node: StorefrontProductNode | null | undefined): Product | null {
  if (!node?.id || !node.handle) {
    return null;
  }

  const images =
    node.images?.edges
      ?.map((e) => normalizeImage(e.node))
      .filter((img): img is Image => img !== null) ?? [];

  const variants =
    node.variants?.edges?.map((e) => normalizeVariant(e.node)).filter(Boolean) ?? [];

  const min = normalizeMoney(node.priceRange?.minVariantPrice);
  const max = normalizeMoney(node.priceRange?.maxVariantPrice);

  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description ?? undefined,
    descriptionHtml: node.descriptionHtml ?? undefined,
    availableForSale: node.availableForSale,
    vendor: node.vendor ?? undefined,
    productType: node.productType ?? undefined,
    tags: node.tags ?? [],
    images,
    variants,
    priceRange: { minVariantPrice: min, maxVariantPrice: max },
  };
}

type ProductByHandleData = { product: StorefrontProductNode | null };
type ProductsSearchData = { products: { edges: { node: StorefrontProductNode }[] } | null };

export type GetProductOptions = {
  signal?: AbortSignal;
};

/** Single product by handle from Koko Bay or Storefront. Returns null when unavailable. */
export async function getProduct(handle: string, options?: GetProductOptions): Promise<Product | null> {
  const safeHandle = handle?.trim();
  if (!safeHandle) {
    return null;
  }

  if (options?.signal?.aborted) {
    return null;
  }

  if (isKokobayWebProductsConfigured()) {
    const fromKokobay = (await fetchKokobayProductByHandle(safeHandle, options)) ?? null;
    if (!fromKokobay) return null;
    return enrichProductGalleryFromShopify(fromKokobay, options);
  }

  try {
    const data = await fetchShopify<ProductByHandleData>(
      GET_PRODUCT_BY_HANDLE,
      {
        handle: safeHandle,
      },
      { signal: options?.signal },
    );
    const product = data?.product ? normalizeProduct(data.product) : null;
    return product ?? null;
  } catch {
    return null;
  }
}

/** Koko Bay PDP API may omit the gallery until deployed — backfill from Storefront when needed. */
async function enrichProductGalleryFromShopify(
  product: Product,
  options?: GetProductOptions,
): Promise<Product> {
  if (product.images.length > 1 || !isShopifyConfigured()) {
    return product;
  }

  if (options?.signal?.aborted) {
    return product;
  }

  try {
    const data = await fetchShopify<ProductByHandleData>(
      GET_PRODUCT_BY_HANDLE,
      {
        handle: product.handle,
      },
      { signal: options?.signal },
    );
    const shopifyProduct = data?.product ? normalizeProduct(data.product) : null;
    if (!shopifyProduct?.images.length || shopifyProduct.images.length <= product.images.length) {
      return product;
    }
    return { ...product, images: shopifyProduct.images };
  } catch {
    return product;
  }
}

/** Storefront product search via `products(query: ...)`. Returns an empty list on failure. */
export async function searchProducts(query: string, first = 20): Promise<Product[]> {
  const safeQuery = query?.trim() ?? '';
  if (!safeQuery) {
    return [];
  }

  const wildcard = safeQuery === '*';

  if (wildcard) {
    if (isKokobayWebProductsConfigured()) {
      const page = await fetchKokobayProductsPage({ first });
      return page?.items ?? [];
    }
    try {
      const data = await fetchShopify<ProductsSearchData>(LIST_PRODUCTS_NEWEST_FIRST, {
        first,
      });
      const edges = data?.products?.edges;
      if (!edges?.length) {
        return [];
      }
      return edges
        .map((e) => normalizeProduct(e.node))
        .filter((p): p is Product => p !== null);
    } catch {
      return [];
    }
  }

  if (isKokobayWebProductsConfigured()) {
    const fromSearch = await fetchKokobaySearchProducts(safeQuery, first);
    return fromSearch?.slice(0, first) ?? [];
  }

  try {
    const data = await fetchShopify<ProductsSearchData>(SEARCH_PRODUCTS, {
      query: safeQuery,
      first,
    });
    const edges = data?.products?.edges;
    if (!edges?.length) {
      return [];
    }
    const mapped = edges
      .map((e) => normalizeProduct(e.node))
      .filter((p): p is Product => p !== null);
    return mapped;
  } catch {
    return [];
  }
}
