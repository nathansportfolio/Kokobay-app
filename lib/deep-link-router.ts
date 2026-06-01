import type { Href } from 'expo-router';

import {
  APP_URL_SCHEME,
  KOKOBAY_STORE_HOSTS,
  LEGACY_APP_URL_SCHEME,
} from '@/lib/deep-link-constants';

export const DEEP_LINK_FALLBACK_HREF = '/(tabs)' as Href;

export type DeepLinkKind =
  | 'product'
  | 'collection'
  | 'search'
  | 'content'
  | 'order'
  | 'wishlist'
  | 'cart'
  | 'account'
  | 'home'
  | 'unhandled';

export type ResolveDeepLinkResult = {
  kind: DeepLinkKind;
  /** Expo Router destination when routable. */
  href: Href | null;
  /** Normalized store path for logging (e.g. `/products/black-bikini`). */
  canonicalPath: string | null;
  reason?: string;
  fallbackHref: Href;
};

function pathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}

export function isKokobayStoreHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return KOKOBAY_STORE_HOSTS.some((allowed) => {
    const normalized = allowed.replace(/^www\./, '');
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

/** Strips query/hash; ensures leading slash. */
export function normalizeStorePathname(pathname: string): string {
  const path = pathname.split('?')[0]?.split('#')[0]?.trim() || '/';
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  if (withLeading.length > 1 && withLeading.endsWith('/')) {
    return withLeading.slice(0, -1);
  }
  return withLeading || '/';
}

function productHref(handle: string): Href {
  return `/product/${pathSegment(handle)}` as Href;
}

function collectionHref(handle: string): Href {
  return `/collection/${pathSegment(handle)}` as Href;
}

function searchHref(query: string): Href {
  return {
    pathname: '/(tabs)/search',
    params: { q: query.trim() },
  } as Href;
}

function contentHref(slug: string): Href {
  return `/content/${pathSegment(slug)}` as Href;
}

function orderHref(orderId: string): Href {
  return `/account/orders/${pathSegment(orderId)}` as Href;
}

function resolvePathAndQuery(path: string, searchParams: URLSearchParams): ResolveDeepLinkResult | null {
  const pathname = normalizeStorePathname(path);

  const productsMatch = pathname.match(/^\/products\/([^/]+)$/);
  if (productsMatch?.[1]) {
    const handle = decodePathSegment(productsMatch[1]);
    return {
      kind: 'product',
      href: productHref(handle),
      canonicalPath: `/products/${handle}`,
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  const productTabMatch = pathname.match(/^\/product\/([^/]+)$/);
  if (productTabMatch?.[1]) {
    const handle = decodePathSegment(productTabMatch[1]);
    return {
      kind: 'product',
      href: productHref(handle),
      canonicalPath: `/products/${handle}`,
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  const collectionsMatch = pathname.match(/^\/collections\/([^/]+)$/);
  if (collectionsMatch?.[1]) {
    const handle = decodePathSegment(collectionsMatch[1]);
    return {
      kind: 'collection',
      href: collectionHref(handle),
      canonicalPath: `/collections/${handle}`,
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  const collectionTabMatch = pathname.match(/^\/collection\/([^/]+)$/);
  if (collectionTabMatch?.[1]) {
    const handle = decodePathSegment(collectionTabMatch[1]);
    return {
      kind: 'collection',
      href: collectionHref(handle),
      canonicalPath: `/collections/${handle}`,
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  if (pathname === '/search' || pathname.startsWith('/search/')) {
    const q =
      searchParams.get('q')?.trim() ||
      searchParams.get('query')?.trim() ||
      searchParams.get('s')?.trim() ||
      '';
    if (q) {
      return {
        kind: 'search',
        href: searchHref(q),
        canonicalPath: `/search?q=${encodeURIComponent(q)}`,
        fallbackHref: DEEP_LINK_FALLBACK_HREF,
      };
    }
    return {
      kind: 'search',
      href: '/search-overlay' as Href,
      canonicalPath: '/search',
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  const pagesMatch = pathname.match(/^\/pages\/([^/]+)$/);
  if (pagesMatch?.[1]) {
    const slug = decodePathSegment(pagesMatch[1]);
    return {
      kind: 'content',
      href: contentHref(slug),
      canonicalPath: `/pages/${slug}`,
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  const contentMatch = pathname.match(/^\/content\/([^/]+)$/);
  if (contentMatch?.[1]) {
    const slug = decodePathSegment(contentMatch[1]);
    return {
      kind: 'content',
      href: contentHref(slug),
      canonicalPath: `/content/${slug}`,
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  const orderMatch = pathname.match(/^\/account\/orders\/([^/]+)$/);
  if (orderMatch?.[1]) {
    const orderId = decodePathSegment(orderMatch[1]);
    return {
      kind: 'order',
      href: orderHref(orderId),
      canonicalPath: `/account/orders/${orderId}`,
      fallbackHref: '/(tabs)/account' as Href,
    };
  }

  if (pathname === '/cart') {
    return {
      kind: 'cart',
      href: '/(tabs)/cart' as Href,
      canonicalPath: '/cart',
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  if (pathname === '/wishlist') {
    return {
      kind: 'wishlist',
      href: '/(tabs)/wishlist' as Href,
      canonicalPath: '/wishlist',
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  if (pathname === '/account' || pathname.startsWith('/account/')) {
    return {
      kind: 'account',
      href: '/(tabs)/account' as Href,
      canonicalPath: pathname,
      fallbackHref: '/(tabs)/account' as Href,
    };
  }

  if (pathname === '/' || pathname === '') {
    return {
      kind: 'home',
      href: DEEP_LINK_FALLBACK_HREF,
      canonicalPath: '/',
      fallbackHref: DEEP_LINK_FALLBACK_HREF,
    };
  }

  return null;
}

/**
 * Parses a Koko Bay store URL, custom scheme link, or in-app path into an Expo Router href.
 *
 * @example `https://www.kokobay.co.uk/products/black-bikini`
 * @example `https://kokobay.co.uk/collections/sale`
 * @example `https://www.kokobay.co.uk/search?q=linen+dress`
 * @example `kokobay://products/black-bikini`
 */
export function resolveDeepLinkUrl(url: string): ResolveDeepLinkResult {
  const trimmed = url.trim();
  if (!trimmed) {
    return unhandled('empty_url');
  }

  if (trimmed.startsWith(`${APP_URL_SCHEME}://`) || trimmed.startsWith(`${LEGACY_APP_URL_SCHEME}://`)) {
    const rawPath = trimmed.replace(/^kokobay(?:app)?:\/\//i, '');
    const queryIndex = rawPath.indexOf('?');
    const pathOnly = queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath;
    const query = queryIndex >= 0 ? rawPath.slice(queryIndex + 1) : '';
    const path = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    const parsed = resolvePathAndQuery(path, new URLSearchParams(query));
    if (parsed) return parsed;
    return unhandled('unknown_custom_scheme_path', path);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!isKokobayStoreHost(parsed.hostname)) {
        return unhandled('host_not_allowed', parsed.hostname);
      }
      const resolved = resolvePathAndQuery(parsed.pathname, parsed.searchParams);
      if (resolved) return resolved;
      return unhandled('unknown_https_path', parsed.pathname);
    } catch {
      return unhandled('invalid_url');
    }
  }

  if (trimmed.startsWith('/')) {
    const queryIndex = trimmed.indexOf('?');
    const pathOnly = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
    const query = queryIndex >= 0 ? trimmed.slice(queryIndex + 1) : '';
    const resolved = resolvePathAndQuery(pathOnly, new URLSearchParams(query));
    if (resolved) return resolved;
    return unhandled('unknown_path', pathOnly);
  }

  return unhandled('unsupported_format');
}

function unhandled(reason: string, detail?: string): ResolveDeepLinkResult {
  return {
    kind: 'unhandled',
    href: null,
    canonicalPath: detail ?? null,
    reason,
    fallbackHref: DEEP_LINK_FALLBACK_HREF,
  };
}

/** Target href for navigation (primary or fallback). */
export function deepLinkTargetHref(result: ResolveDeepLinkResult): Href {
  return result.href ?? result.fallbackHref;
}

export function hrefToLogString(href: Href): string {
  if (typeof href === 'string') return href;
  const params = href.params ?
    `?${new URLSearchParams(href.params as Record<string, string>).toString()}`
  : '';
  return `${href.pathname ?? '/'}${params}`;
}
