/**
 * Tab-stack routes use pathless `(tabs)` / `index` groups, so `useSegments()` returns
 * leaf names like `search` or `collection` — never `(tabs)`.
 */
export function isTabRoutePathname(pathname: string): boolean {
  if (!pathname || pathname === '/search-overlay') return false;

  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/products/') ||
    pathname.startsWith('/pages/') ||
    pathname.startsWith('/content/') ||
    pathname.startsWith('/account/orders/')
  ) {
    return false;
  }

  return true;
}
