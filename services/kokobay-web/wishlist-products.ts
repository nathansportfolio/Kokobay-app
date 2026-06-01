import {
  fetchKokobayJson,
  isKokobayWebProductsConfigured,
  KokobayApiError,
} from '@/services/kokobay-web/client';
import type { WishlistProductPreview } from '@/types/wishlist-product-preview';

function isWishlistPreview(row: unknown): row is WishlistProductPreview {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.handle === 'string' &&
    typeof r.title === 'string' &&
    typeof r.price === 'number' &&
    typeof r.available === 'boolean' &&
    (r.imageUrl === null || typeof r.imageUrl === 'string')
  );
}

function normalizePreviews(raw: unknown): WishlistProductPreview[] {
  if (!Array.isArray(raw)) {
    throw new KokobayApiError('Invalid wishlist response');
  }
  return raw.filter(isWishlistPreview);
}

/**
 * `GET /api/wishlist-products?handles=a,b,c` — slim batched previews (image, title, price).
 * Country/currency query params are appended by {@link fetchKokobayJson}.
 * @throws {@link KokobayApiError} on network / HTTP / parse failure
 */
export async function fetchWishlistProductPreviews(
  handles: readonly string[],
  init?: { signal?: AbortSignal },
): Promise<WishlistProductPreview[]> {
  if (!isKokobayWebProductsConfigured() || handles.length === 0) {
    return [];
  }

  const params = new URLSearchParams({ handles: handles.join(',') });
  const data = await fetchKokobayJson(`/api/wishlist-products?${params.toString()}`, init);

  if (Array.isArray(data)) {
    return normalizePreviews(data);
  }

  throw new KokobayApiError('Invalid wishlist response');
}
