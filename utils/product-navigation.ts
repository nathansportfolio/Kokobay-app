import type { Href } from 'expo-router';

export function isHomePath(pathname: string): boolean {
  const path = pathname.trim();
  if (!path || path === '/') return true;
  if (path === '/(tabs)' || path === '/(tabs)/') return true;
  return /^\/(\(tabs\)\/)?index\/?$/.test(path);
}

export function isProductPath(path: string): boolean {
  return path.trim().startsWith('/product/');
}

/** Collection/search PLP — explicit back targets from PDP `returnTo`. */
export function isCatalogListingPath(path: string): boolean {
  const p = path.trim();
  return (
    p.startsWith('/collection/') ||
    p.startsWith('/categories/collection/') ||
    p.startsWith('/index/collection/') ||
    p.startsWith('/search') ||
    p.startsWith('/index/search')
  );
}

/** Preserve the originating PLP when opening another product from a PDP. */
export function productReturnToParam(pathname: string, existingReturnTo?: string): string {
  const path = pathname.trim();
  const preserved = existingReturnTo?.trim() ?? '';
  if (path.startsWith('/product/')) {
    return preserved || path;
  }
  return path || preserved;
}

/**
 * When opening a related product, chain back through the current PDP first
 * while preserving the outer PLP/search origin on the previous page.
 */
export function pdpRelatedProductReturnTo(pathname: string, outerReturnTo?: string): string {
  const path = pathname.trim();
  if (!path.startsWith('/product/')) {
    return outerReturnTo?.trim() || path;
  }
  const outer = outerReturnTo?.trim();
  if (!outer) return path;
  const qs = new URLSearchParams({ returnTo: outer });
  return `${path}?${qs.toString()}`;
}

export function productHref(handle: string, returnTo?: string, variantId?: string): Href {
  const safe = handle.trim();
  if (!safe) return '/' as Href;
  const params = new URLSearchParams();
  const target = returnTo?.trim();
  const variant = variantId?.trim();
  if (target) params.set('returnTo', target);
  if (variant) params.set('variantId', variant);
  const qs = params.toString();
  if (!qs) return `/product/${safe}` as Href;
  return `/product/${safe}?${qs}` as Href;
}

/** True when PDP back should follow an explicit `returnTo` param instead of tab history. */
export function shouldFollowProductReturnTo(returnTo: string | undefined): boolean {
  const target = returnTo?.trim() ?? '';
  if (!target) return false;
  return isProductPath(target) || isCatalogListingPath(target) || target.startsWith('/wishlist');
}
