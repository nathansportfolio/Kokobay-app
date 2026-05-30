import type { Href } from 'expo-router';

/** Preserve the originating PLP when opening related products from a PDP. */
export function productReturnToParam(pathname: string, existingReturnTo?: string): string {
  const path = pathname.trim();
  const preserved = existingReturnTo?.trim() ?? '';
  if (path.startsWith('/product/')) {
    return preserved || path;
  }
  return path || preserved;
}

export function productHref(handle: string, returnTo?: string): Href {
  const safe = handle.trim();
  if (!safe) return '/' as Href;
  const target = returnTo?.trim();
  if (!target) return `/product/${safe}` as Href;
  const qs = new URLSearchParams({ returnTo: target });
  return `/product/${safe}?${qs.toString()}` as Href;
}
