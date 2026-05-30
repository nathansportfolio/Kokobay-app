import type { Product } from '@/types/shopify';

/** Catalog/search cards use a single placeholder variant — sizes need a full product fetch. */
export function isCatalogPreviewProduct(product: Product): boolean {
  return product.variants.length === 1 && product.variants[0].id.endsWith('-preview');
}

/** True when no variant can be purchased (aligns with PDP “fully out of stock”). */
export function isProductFullySoldOut(product: Product): boolean {
  if (!product.variants.length) {
    return !product.availableForSale;
  }
  return !product.variants.some((v) => v.availableForSale);
}
