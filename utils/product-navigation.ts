import type { Href } from 'expo-router';

/** Temporary Klaviyo variant deep-link test — remove when done. */
const FORCE_VARIANT_DEEP_LINK_TEST = __DEV__;
const FORCE_VARIANT_DEEP_LINK_ID = 'gid://shopify/ProductVariant/55564963512706';

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
  if (FORCE_VARIANT_DEEP_LINK_TEST) {
    return `/products/${encodeURIComponent(FORCE_VARIANT_DEEP_LINK_ID)}` as Href;
  }

  const safe = handle.trim();
  if (!safe) return '/' as Href;
  const target = returnTo?.trim();
  if (!target) return `/product/${safe}` as Href;
  const qs = new URLSearchParams({ returnTo: target });
  return `/product/${safe}?${qs.toString()}` as Href;
}
