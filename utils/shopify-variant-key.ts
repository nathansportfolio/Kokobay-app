/** Canonical key for matching Shopify variant ids (GID vs numeric). */
export function shopifyVariantKey(variantId: string): string {
  const trimmed = variantId.trim();
  const gidMatch = trimmed.match(/ProductVariant\/(\d+)/i);
  if (gidMatch) return gidMatch[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return trimmed.toLowerCase();
}
