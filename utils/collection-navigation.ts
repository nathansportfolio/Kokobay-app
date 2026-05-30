import type { Href, Router } from 'expo-router';

/** Tab root — home index (`unstable_settings.anchor`). */
export const HOME_TAB_HREF = '/(tabs)' as Href;

/** Preserve the originating screen when opening another collection from a PLP. */
export function collectionReturnToParam(pathname: string, existingReturnTo?: string): string {
  const path = pathname.trim();
  const preserved = existingReturnTo?.trim() ?? '';
  if (path.startsWith('/collection/')) {
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

export function collectionHref(handle: string, returnTo?: string): Href {
  const safe = handle.trim();
  if (!safe) return '/' as Href;
  const target = returnTo?.trim();
  if (!target) return `/collection/${safe}` as Href;
  const qs = new URLSearchParams({ returnTo: target });
  return `/collection/${safe}?${qs.toString()}` as Href;
}
