/**
 * Shopify `image.src` can rarely be corrupted (e.g. HTML merged into the string). Those must not
 * be passed to expo-image or they fail silently / throw.
 */
export function isLikelyRemoteImageUrl(uri: string | null | undefined): boolean {
  if (uri == null || typeof uri !== 'string') return false;
  const u = uri.trim();
  if (!u.startsWith('https://') && !u.startsWith('http://')) return false;
  if (u.includes('<') || u.includes('>') || u.includes('\n') || u.includes('\r')) return false;
  try {
    return Boolean(new URL(u).hostname);
  } catch {
    return false;
  }
}

export function firstValidProductImage(product: {
  images: { url: string; width?: number | null; height?: number | null }[];
}): { url: string; width?: number | null; height?: number | null } | undefined {
  for (const img of product.images) {
    if (isLikelyRemoteImageUrl(img.url)) {
      return { url: img.url.trim(), width: img.width, height: img.height };
    }
  }
  return undefined;
}

export function firstValidProductImageUrl(product: { images: { url: string }[] }): string | undefined {
  return firstValidProductImage(product)?.url;
}
