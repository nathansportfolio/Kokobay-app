import type { ShopifyCartSnapshot } from '@/services/shopify/cart';
import type { Money } from '@/types/shopify';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

export type CartSnapshotValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

function parseMoneyAmount(m: Money | null | undefined): number | null {
  if (m?.amount == null || String(m.amount).trim() === '') return null;
  const value = Number.parseFloat(String(m.amount));
  return Number.isFinite(value) ? value : null;
}

/** Validate a remote cart snapshot before it touches local state. */
export function validateCartSnapshot(snapshot: ShopifyCartSnapshot): CartSnapshotValidationResult {
  if (!snapshot.cartId?.trim()) {
    return { ok: false, reason: 'missing_cart_id' };
  }

  const lineCount = snapshot.lines.length;
  const subtotal = parseMoneyAmount(snapshot.subtotal);
  const total = parseMoneyAmount(snapshot.total);

  if (lineCount === 0 && subtotal != null && subtotal > 0) {
    return { ok: false, reason: 'empty_lines_nonzero_subtotal' };
  }
  if (lineCount === 0 && total != null && total > 0) {
    return { ok: false, reason: 'empty_lines_nonzero_total' };
  }

  const variantKeys = new Set<string>();
  for (const line of snapshot.lines) {
    if (line.qty < 0) {
      return { ok: false, reason: 'negative_quantity' };
    }
    const variantId = line.variantId?.trim();
    if (!variantId) {
      return { ok: false, reason: 'missing_variant_id' };
    }
    const key = shopifyVariantKey(variantId);
    if (variantKeys.has(key)) {
      return { ok: false, reason: 'duplicate_variant_id' };
    }
    variantKeys.add(key);
  }

  return { ok: true };
}

/**
 * Extract a server snapshot version when the API provides one.
 * Koko Bay `/api/cart` and Storefront cart snapshots do not currently expose these fields.
 */
export function extractSnapshotVersion(
  snapshot: ShopifyCartSnapshot,
): string | number | null {
  const raw = snapshot as ShopifyCartSnapshot & Record<string, unknown>;
  for (const key of ['updatedAt', 'cartUpdatedAt', 'version', 'etag', 'revision'] as const) {
    const value = raw[key];
    if (value == null || value === '') continue;
    if (typeof value === 'number' || typeof value === 'string') return value;
  }
  return null;
}

export function compareSnapshotVersions(
  incoming: string | number | null,
  stored: string | number | null,
): 'newer' | 'older' | 'equal' | 'unknown' {
  if (incoming == null || stored == null) return 'unknown';
  if (incoming === stored) return 'equal';

  const incomingMs = parseVersionToMs(incoming);
  const storedMs = parseVersionToMs(stored);
  if (incomingMs != null && storedMs != null) {
    if (incomingMs > storedMs) return 'newer';
    if (incomingMs < storedMs) return 'older';
    return 'equal';
  }

  const incomingNum = typeof incoming === 'number' ? incoming : Number.parseFloat(String(incoming));
  const storedNum = typeof stored === 'number' ? stored : Number.parseFloat(String(stored));
  if (Number.isFinite(incomingNum) && Number.isFinite(storedNum)) {
    if (incomingNum > storedNum) return 'newer';
    if (incomingNum < storedNum) return 'older';
    return 'equal';
  }

  return String(incoming) > String(stored) ? 'newer' : 'older';
}

function parseVersionToMs(value: string | number): number | null {
  if (typeof value === 'number' && value > 1e12) return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
