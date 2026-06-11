import { api } from '@/src/core/api';
import { jsonAnySchema } from '@/src/core/api/schemas';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { KokobayApiError } from '@/services/kokobay-web/api-errors';

export type RemoteWishlistItem = {
  productHandle: string;
  productId?: string;
  variantId?: string;
  addedAt: string;
};

export type RemoteWishlistResponse = {
  ok: true;
  userUid: string;
  items: RemoteWishlistItem[];
};

function encodeWishlistUserUid(userUid: string): string {
  return encodeURIComponent(userUid.trim());
}

function isRemoteWishlistItem(row: unknown): row is RemoteWishlistItem {
  if (!row || typeof row !== 'object') return false;
  const record = row as Record<string, unknown>;
  return (
    typeof record.productHandle === 'string' &&
    typeof record.addedAt === 'string' &&
    record.productHandle.trim().length > 0
  );
}

function parseRemoteWishlistResponse(data: unknown): RemoteWishlistResponse | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.ok !== true || typeof record.userUid !== 'string') return null;
  if (!Array.isArray(record.items)) return null;
  const items = record.items.filter(isRemoteWishlistItem);
  return {
    ok: true,
    userUid: record.userUid.trim(),
    items,
  };
}

/**
 * `GET /api/wishlists/[userUid]` — persisted handles from MongoDB.
 * Pass `country` when product enrichment is needed (optional).
 */
export async function fetchRemoteWishlist(
  userUid: string,
  init?: { signal?: AbortSignal; country?: string },
): Promise<RemoteWishlistResponse | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const uid = userUid.trim();
  if (!uid) return null;

  const params = new URLSearchParams();
  if (init?.country?.trim()) {
    params.set('country', init.country.trim().toUpperCase());
  }
  const query = params.toString();
  const path = `/api/wishlists/${encodeWishlistUserUid(uid)}${query ? `?${query}` : ''}`;

  try {
    const response = await api.get(path, {
      auth: 'none',
      marketQuery: !init?.country?.trim(),
      signal: init?.signal,
      coalesce: false,
      schema: jsonAnySchema,
    });
    return parseRemoteWishlistResponse(response.data);
  } catch (error) {
    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[WISHLIST API] fetch failed', { path, message });
    }
    return null;
  }
}

/** `POST /api/wishlists/[userUid]/items` — best-effort; failures are non-fatal. */
export async function addRemoteWishlistItem(
  userUid: string,
  productHandle: string,
  init?: { productId?: string; variantId?: string },
): Promise<boolean> {
  if (!isKokobayWebProductsConfigured()) return false;

  const uid = userUid.trim();
  const handle = productHandle.trim().toLowerCase();
  if (!uid || !handle) return false;

  const path = `/api/wishlists/${encodeWishlistUserUid(uid)}/items`;
  const body: Record<string, string> = { productHandle: handle };
  if (init?.productId?.trim()) body.productId = init.productId.trim();
  if (init?.variantId?.trim()) body.variantId = init.variantId.trim();

  try {
    const response = await api.post(path, body, {
      auth: 'none',
      marketQuery: false,
      coalesce: false,
      retries: 0,
      schema: jsonAnySchema,
    });
    const data = response.data as Record<string, unknown>;
    return data?.ok === true;
  } catch (error) {
    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[WISHLIST API] add failed', { handle, message });
    }
    return false;
  }
}

/** `DELETE /api/wishlists/[userUid]/items?productHandle=` — best-effort. */
export async function removeRemoteWishlistItem(
  userUid: string,
  productHandle: string,
): Promise<boolean> {
  if (!isKokobayWebProductsConfigured()) return false;

  const uid = userUid.trim();
  const handle = productHandle.trim().toLowerCase();
  if (!uid || !handle) return false;

  const params = new URLSearchParams({ productHandle: handle });
  const path = `/api/wishlists/${encodeWishlistUserUid(uid)}/items?${params.toString()}`;

  try {
    const response = await api.delete(path, {
      auth: 'none',
      marketQuery: false,
      coalesce: false,
      retries: 0,
      schema: jsonAnySchema,
    });
    const data = response?.data as Record<string, unknown> | undefined;
    return data?.ok === true;
  } catch (error) {
    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[WISHLIST API] remove failed', { handle, message });
    }
    return false;
  }
}

/** @internal */
export function assertRemoteWishlistResponse(data: unknown): RemoteWishlistResponse {
  const parsed = parseRemoteWishlistResponse(data);
  if (!parsed) throw new KokobayApiError('Invalid wishlist response');
  return parsed;
}
