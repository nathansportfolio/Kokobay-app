/** Extract Shopify collection handle from a storefront URL path. */
export function extractCollectionHandleFromCmsUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/collections\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]).trim() : null;
  } catch {
    const match = trimmed.match(/\/collections\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]).trim() : null;
  }
}
