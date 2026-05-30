import type { Product } from '@/types/shopify';

/** Append-only flatten with stable dedupe by product id (first occurrence wins). */
export function dedupeProductsById(products: readonly Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const product of products) {
    const id = product.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(product);
  }
  return out;
}

/**
 * Flattens only pages still in the infinite query (`maxPages` trims oldest pages upstream).
 * Does not retain dropped pages — output size is bounded by TanStack `maxPages` × page size.
 */
export function flattenCatalogProductPages(
  pages: readonly { products: Product[] }[] | undefined,
): Product[] | undefined {
  if (!pages?.length) return pages ? [] : undefined;
  return dedupeProductsById(pages.flatMap((page) => page.products));
}
