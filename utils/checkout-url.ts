import type { CartLine } from '@/types/cart';

/** Checkout/cart attribution — appended to every app-generated checkout URL. */
export const APP_CHECKOUT_SOURCE = 'app';

/** Hostnames allowed inside the in-app checkout WebView. */
export function isAllowedCheckoutHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  if (h === 'kokobay.co.uk') return true;
  if (h.endsWith('.kokobay.co.uk')) return true;
  if (h.endsWith('.myshopify.com')) return true;
  if (h === 'shop.app' || h.endsWith('.shop.app')) return true;
  if (h === 'shopify.com' || h.endsWith('.shopify.com')) return true;
  if (h.endsWith('.shopifycs.com')) return true;
  return false;
}

export function isAllowedCheckoutUrl(url: string): boolean {
  if (isWebViewSubresourceUrl(url)) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return isAllowedCheckoutHost(parsed.hostname);
  } catch {
    return false;
  }
}

/** iframe / OAuth hops — must not trigger app exit. */
export function isWebViewSubresourceUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (!lower) return true;
  if (lower === 'about:blank' || lower.startsWith('about:')) return true;
  if (lower.startsWith('javascript:')) return true;
  if (lower.startsWith('data:')) return true;
  return false;
}

/** Shop Pay, checkout modal, and other Shopify `/services/*` endpoints on the storefront domain. */
export function isShopifyCheckoutServiceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    if (path.startsWith('/services/')) return true;
    if (search.includes('checkout_token=')) return true;
    if (search.includes('flow=checkout')) return true;
    if (search.includes('checkout_modal')) return true;
    if (search.includes('ux_mode=iframe')) return true;
    if (search.includes('loginwithshop')) return true;

    return false;
  } catch {
    return false;
  }
}

/** Storefront API cart checkout link (`/cart/c/{id}`) — market-aware via Storefront cart sync. */
export function isStorefrontCartCheckoutUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return pathname.includes('/cart/c/');
  } catch {
    return false;
  }
}

/** @deprecated Use {@link isStorefrontCartCheckoutUrl} */
export const isHeadlessCartCheckoutUrl = isStorefrontCartCheckoutUrl;

/** Storefront cart line id → numeric variant id for `/cart/add`. */
export function numericShopifyVariantId(variantId: string): string | null {
  const trimmed = variantId.trim();
  const gidMatch = trimmed.match(/ProductVariant\/(\d+)/i);
  if (gidMatch) return gidMatch[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

/** Origin for the Online Store cart (e.g. `https://www.kokobay.co.uk`). */
export function resolveOnlineStoreOrigin(checkoutUrl?: string | null): string {
  if (checkoutUrl) {
    try {
      const parsed = new URL(checkoutUrl);
      if (isAllowedCheckoutHost(parsed.hostname)) {
        return parsed.origin;
      }
    } catch {
      /* fall through */
    }
  }
  return 'https://www.kokobay.co.uk';
}

/** `/cart/{variant}:{qty},...` — replaces the browser cart (does not stack like `/cart/add`). */
export function isOnlineStoreCartPermalinkPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (!path.startsWith('/cart/')) return false;
  if (path === '/cart' || path.startsWith('/cart/add') || path.includes('/cart/c/')) return false;
  return /^\/cart\/[\d]+:\d+(?:,[\d]+:\d+)*$/.test(path);
}

/**
 * Replaces the Online Store cart and opens theme checkout (`?checkout`).
 * Prefer this over `/cart/add` in the WebView — shared cookies would otherwise inflate qty.
 */
export function buildOnlineStoreCartPermalinkUrl(
  lines: CartLine[],
  options?: { storeOrigin?: string },
): string | null {
  const origin = (options?.storeOrigin ?? resolveOnlineStoreOrigin()).replace(/\/+$/, '');
  const segments: string[] = [];

  for (const line of lines) {
    const id = numericShopifyVariantId(line.variantId);
    const qty = Math.max(1, Math.floor(line.qty));
    if (!id) continue;
    segments.push(`${id}:${qty}`);
  }

  if (!segments.length) return null;
  const params = new URLSearchParams();
  params.set('source', APP_CHECKOUT_SOURCE);
  params.set('checkout', '');
  return `${origin}/cart/${segments.join(',')}?${params.toString()}`;
}

/**
 * Populates the Online Store cart via `/cart/add` (adds to existing browser cart).
 * Fallback when permalink cannot be built.
 */
export function buildOnlineStoreCartAddUrl(
  lines: CartLine[],
  options?: { storeOrigin?: string },
): string | null {
  const origin = (options?.storeOrigin ?? resolveOnlineStoreOrigin()).replace(/\/+$/, '');
  const params = new URLSearchParams();

  for (const line of lines) {
    const id = numericShopifyVariantId(line.variantId);
    const qty = Math.max(1, Math.floor(line.qty));
    if (!id) continue;
    params.append('id[]', id);
    params.append('quantity[]', String(qty));
  }

  if (!params.toString()) return null;
  params.set('source', APP_CHECKOUT_SOURCE);
  params.set('return_to', '/checkout');
  return `${origin}/cart/add?${params.toString()}`;
}

export function isOnlineStoreCartPage(url: string): boolean {
  return shouldRedirectCheckoutToAppCart(url);
}

/**
 * Theme cart links during checkout → native bag.
 * Matches `kokobay.co.uk/cart` but not `/cart/add` (checkout bootstrap).
 */
function isKokobayStoreHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return h === 'kokobay.co.uk' || h.endsWith('.kokobay.co.uk');
}

export function shouldRedirectCheckoutToAppCart(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isKokobayStoreHostname(parsed.hostname)) return false;
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return path === '/cart';
  } catch {
    return false;
  }
}

/**
 * Shopify customer login during checkout (`/account/login?checkout_url=...`) → native sign-in.
 * Requires `checkout_url` so we only intercept the checkout login hop, not generic account links.
 */
export function shouldRedirectCheckoutToAppLogin(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isKokobayStoreHostname(parsed.hostname)) return false;
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/account/login') return false;
    return Boolean(parsed.searchParams.get('checkout_url')?.trim());
  } catch {
    return false;
  }
}

/** Absolute checkout resume URL from the storefront login query string. */
export function resolveCheckoutResumeUrlFromLoginPage(url: string): string | null {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('checkout_url')?.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) {
      return isAllowedCheckoutUrl(raw) ? raw : null;
    }
    if (raw.startsWith('/')) {
      const absolute = `${parsed.origin}${raw}`;
      return isAllowedCheckoutUrl(absolute) ? absolute : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Storefront home (`https://www.kokobay.co.uk/`) during checkout → app home tab. */
export function shouldRedirectCheckoutToAppHome(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isKokobayStoreHostname(parsed.hostname)) return false;
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return path === '/';
  } catch {
    return false;
  }
}

export function buildOnlineStoreCheckoutUrl(storeOrigin: string): string {
  return `${storeOrigin.replace(/\/+$/, '')}/checkout`;
}

/** Append `source=app` for checkout attribution (idempotent). */
export function withAppCheckoutSource(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get('source') === APP_CHECKOUT_SOURCE) return url;
    parsed.searchParams.set('source', APP_CHECKOUT_SOURCE);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Storefront `checkoutUrl` from cart sync — safe to load in the WebView as-is. */
export function normalizeStorefrontCheckoutUrl(
  checkoutUrl: string | null | undefined,
): string | null {
  const trimmed = checkoutUrl?.trim();
  if (!trimmed) return null;
  if (!isAllowedCheckoutUrl(trimmed)) return null;
  return trimmed;
}

function finalizeAppCheckoutUrl(url: string | null): string | null {
  if (!url) return null;
  return withAppCheckoutSource(url);
}

export type ResolveCheckoutWebViewUrlOptions = {
  /** Resume URL from login redirect (`/checkout?url=...`). */
  resumeUrl?: string | null;
  /**
   * When true with a signed-in user, return null until sync provides `checkoutUrl`
   * (avoids pinning a permalink before the Storefront cart URL arrives).
   */
  awaitingCheckoutUrl?: boolean;
  /** @deprecated No longer gates checkoutUrl — kept for call-site compatibility. */
  isLoggedIn?: boolean;
};

/**
 * WebView entry URL.
 * - Prefer synced Storefront `checkoutUrl` for any user when valid (preserves cart market/currency).
 * - Fall back to Online Store cart permalink only when checkoutUrl is missing or invalid.
 * Always appends `source=app` for checkout attribution.
 * Never appends `checkout[email]` or currency/country query params.
 */
export function resolveCheckoutWebViewUrl(
  checkoutUrl: string | null | undefined,
  lines: CartLine[],
  options?: ResolveCheckoutWebViewUrlOptions,
): string | null {
  if (!lines.length) return null;

  const normalizedCheckoutUrl = normalizeStorefrontCheckoutUrl(checkoutUrl);

  const resume = normalizeStorefrontCheckoutUrl(options?.resumeUrl);
  if (resume) {
    return finalizeAppCheckoutUrl(resume);
  }

  if (normalizedCheckoutUrl) {
    return finalizeAppCheckoutUrl(normalizedCheckoutUrl);
  }

  if (options?.awaitingCheckoutUrl) {
    return null;
  }

  return finalizeAppCheckoutUrl(
    buildOnlineStoreCartPermalinkUrl(lines, {
      storeOrigin: resolveOnlineStoreOrigin(checkoutUrl),
    }),
  );
}

/** Shopify order confirmation — safe point to clear the local bag. */
export function isCheckoutThankYouUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const host = parsed.hostname.toLowerCase();

    if (path.includes('/thank_you') || path.includes('/thank-you')) return true;
    if (path.includes('/post_purchase')) return true;
    if (path.includes('/order-received')) return true;
    if (path.includes('/orders/') && !path.includes('/orders/new')) return true;
    if (path.includes('/checkouts/') && (path.includes('/thank') || path.includes('order-received'))) {
      return true;
    }
    if (host.includes('shop.app') && path.includes('thank')) return true;

    return false;
  } catch {
    return false;
  }
}

function isStorefrontHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return h === 'kokobay.co.uk' || h.endsWith('.kokobay.co.uk');
}

/** URLs that should remain inside the checkout WebView (Shopify checkout + cart/add hop). */
export function isShopifyCheckoutFlowUrl(url: string): boolean {
  if (isCheckoutThankYouUrl(url)) return true;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === 'checkout.shopify.com') return true;
    if (host.endsWith('.shopifycs.com')) return true;
    if (host.includes('shop.app')) return true;
    if (path.includes('/checkouts/')) return true;
    if (path === '/checkout' || path.startsWith('/checkout/')) return true;
    if (path.startsWith('/cart/add')) return true;
    if (isStorefrontCartCheckoutUrl(url)) return true;
    if (isOnlineStoreCartPermalinkPath(path)) return true;
    if (path.includes('/processing') || path.includes('/payments/')) return true;
    if (isShopifyCheckoutServiceUrl(url)) return true;

    if (host.endsWith('.myshopify.com')) {
      return path.includes('/checkouts/') || path.includes('/checkout') || path.startsWith('/services/');
    }

    return false;
  } catch {
    return false;
  }
}

export type CheckoutWebViewRoute = 'stay' | 'cart' | 'home';

/**
 * Where in-app checkout navigation should go when the WebView hits a URL.
 * - stay: checkout / thank-you / Shopify payment hosts
 * - cart: Online Store `/cart` (theme cart link)
 * - home: storefront browse links (collections, PDP, home, etc.)
 */
export function resolveCheckoutWebViewNavigation(url: string): CheckoutWebViewRoute {
  if (isWebViewSubresourceUrl(url)) return 'stay';
  if (!isAllowedCheckoutUrl(url)) return 'home';
  if (isCheckoutThankYouUrl(url)) return 'stay';
  if (shouldRedirectCheckoutToAppCart(url)) return 'cart';
  if (shouldRedirectCheckoutToAppHome(url)) return 'home';
  if (isShopifyCheckoutFlowUrl(url)) return 'stay';
  if (isShopifyCheckoutServiceUrl(url)) return 'stay';

  try {
    const parsed = new URL(url);
    if (isStorefrontHost(parsed.hostname)) return 'home';
    if (parsed.hostname.toLowerCase().endsWith('.myshopify.com')) return 'home';
  } catch {
    /* fall through */
  }

  return 'stay';
}
