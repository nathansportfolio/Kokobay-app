import type { Product, ProductVariant } from '@/types/shopify';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

/** Unique size labels in first-seen order (matches Shopify variant / option order from the API). */
export function getProductSizeOptions(product: Product): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const v of product.variants) {
    const size = v.selectedOptions.find((x) => x.name.toLowerCase() === 'size')?.value;
    if (size && !seen.has(size)) {
      seen.add(size);
      ordered.push(size);
    }
  }

  return ordered;
}

/** True if any variant with this size option is available to purchase */
export function isSizeAvailable(product: Product, size: string): boolean {
  return product.variants.some(
    (v) =>
      v.selectedOptions.some((o) => o.name.toLowerCase() === 'size' && o.value === size) &&
      v.availableForSale,
  );
}

export function getVariantForSize(product: Product, size: string): ProductVariant | undefined {
  const matches = product.variants.filter((v) =>
    v.selectedOptions.some((o) => o.name.toLowerCase() === 'size' && o.value === size),
  );
  return matches.find((v) => v.availableForSale) ?? matches[0];
}

/** Match a variant by numeric id or Shopify GID. */
export function findVariantById(product: Product, variantId: string): ProductVariant | undefined {
  const key = shopifyVariantKey(variantId);
  return product.variants.find((v) => shopifyVariantKey(v.id) === key);
}
