import type { Href, Router } from 'expo-router';

/** Tab root — home index (`unstable_settings.anchor`). */
export const HOME_TAB_HREF = '/(tabs)' as Href;

/** Collections / shop tab root. */
export const COLLECTIONS_TAB_HREF = '/(tabs)/categories' as Href;

export function isCollectionsTabReturn(path: string): boolean {
  const p = path.trim();
  return (
    p === '/categories' ||
    p === '/(tabs)/categories' ||
    p.startsWith('/(tabs)/categories/')
  );
}

export function isCategoriesStackCollectionPath(pathname: string): boolean {
  return pathname.trim().startsWith('/categories/collection/');
}

/** Preserve the originating screen when opening another collection from a PLP. */
export function collectionReturnToParam(pathname: string, existingReturnTo?: string): string {
  const path = pathname.trim();
  const preserved = existingReturnTo?.trim() ?? '';
  if (path.startsWith('/collection/') || path.startsWith('/categories/collection/')) {
    return preserved || path;
  }
  return path || preserved;
}

/** Pop nested PLP routes and land on the home tab. */
export function navigateToHomeTab(router: Pick<Router, 'dismissTo' | 'replace'>): void {
  if (typeof router.dismissTo === 'function') {
    router.dismissTo(HOME_TAB_HREF);
  }
  router.replace(HOME_TAB_HREF);
}

function collectionPath(handle: string, fromPathname?: string): string {
  const safe = handle.trim();
  if (!safe) return '/';
  // PLP from the Collections tab must push on that tab's stack (NativeTabs + nested stacks).
  if (fromPathname?.trim().startsWith('/categories')) {
    return `/categories/collection/${safe}`;
  }
  return `/collection/${safe}`;
}

export function collectionHref(handle: string, returnTo?: string, fromPathname?: string): Href {
  const base = collectionPath(handle, fromPathname);
  if (base === '/') return '/' as Href;
  const target = returnTo?.trim();
  if (!target) return base as Href;
  const qs = new URLSearchParams({ returnTo: target });
  return `${base}?${qs.toString()}` as Href;
}

/** Prefer over `<Link href={collectionHref(...)}>` on iOS NativeTabs. */
export function pushCollection(
  router: Pick<Router, 'push'>,
  handle: string,
  returnTo?: string,
  fromPathname?: string,
): void {
  router.push(collectionHref(handle, returnTo, fromPathname));
}
