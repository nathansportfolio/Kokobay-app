/** Audit Shopify checkout → shop.app redirects. Filter Metro / Vercel with `[SHOPIFY_REDIRECT_TRACE]`. */

export type ShopifyRedirectTraceEvent =
  | 'shopify_storefront_api'
  | 'backend_api_response'
  | 'webview_resolved'
  | 'webview_initial_load'
  | 'webview_navigation';

export type ShopifyRedirectTracePayload = {
  originalUrl: string | null;
  redirectedUrl: string | null;
  hostChanged: boolean;
  redirectCount: number;
  event?: ShopifyRedirectTraceEvent;
  checkoutUrl?: string | null;
  storeCheckoutUrl?: string | null;
  host?: string | null;
  isShopApp?: boolean;
  queryKeys?: string[];
  shopPayRelatedParams?: Record<string, string>;
  loading?: boolean;
  method?: string;
  path?: string;
  cartId?: string | null;
  previousUrl?: string | null;
  checkoutUrlHost?: string | null;
  checkoutUrlIsShopApp?: boolean;
  checkoutQueryKeys?: string[];
  checkoutShopPayRelatedParams?: Record<string, string>;
  storeCheckoutUrlHost?: string | null;
  storeCheckoutUrlIsShopApp?: boolean;
  storeCheckoutQueryKeys?: string[];
  storeCheckoutShopPayRelatedParams?: Record<string, string>;
  inputCheckoutUrl?: string | null;
  outputUrl?: string | null;
  usedResumeUrl?: boolean;
  usedFallbackPermalink?: boolean;
};

const SHOP_PAY_QUERY_KEYS = [
  'loginwithshop',
  'shop_pay',
  'skip_shop_pay',
  'mobile_app',
  'checkout_token',
  'flow',
  'ux_mode',
  'source',
  'redirect',
  'return_to',
] as const;

let sessionOriginalUrl: string | null = null;
let lastNavigationUrl: string | null = null;
let redirectCount = 0;

function trimUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  return trimmed || null;
}

function parseHost(url: string | null | undefined): string | null {
  const trimmed = trimUrl(url);
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isShopAppHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === 'shop.app' || h.endsWith('.shop.app');
}

export function analyzeCheckoutUrl(url: string | null | undefined): {
  url: string | null;
  host: string | null;
  isShopApp: boolean;
  queryKeys: string[];
  shopPayRelatedParams: Record<string, string>;
} {
  const trimmed = trimUrl(url);
  if (!trimmed) {
    return {
      url: null,
      host: null,
      isShopApp: false,
      queryKeys: [],
      shopPayRelatedParams: {},
    };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const queryKeys = [...parsed.searchParams.keys()].sort();
    const shopPayRelatedParams: Record<string, string> = {};
    for (const key of SHOP_PAY_QUERY_KEYS) {
      const value = parsed.searchParams.get(key);
      if (value != null && value !== '') {
        shopPayRelatedParams[key] = value;
      }
    }
    return {
      url: trimmed,
      host,
      isShopApp: isShopAppHost(host),
      queryKeys,
      shopPayRelatedParams,
    };
  } catch {
    return {
      url: trimmed,
      host: null,
      isShopApp: false,
      queryKeys: [],
      shopPayRelatedParams: {},
    };
  }
}

export function resetShopifyRedirectTraceSession(initialUrl?: string | null): void {
  redirectCount = 0;
  lastNavigationUrl = null;
  sessionOriginalUrl = trimUrl(initialUrl);
}

export function logShopifyRedirectTrace(payload: ShopifyRedirectTracePayload): void {
  console.log('[SHOPIFY_REDIRECT_TRACE]', payload);
}

export function logShopifyRedirectTraceSource(
  event: ShopifyRedirectTraceEvent,
  detail: {
    checkoutUrl?: string | null;
    storeCheckoutUrl?: string | null;
    url?: string | null;
    method?: string;
    path?: string;
    cartId?: string | null;
    usedResumeUrl?: boolean;
    usedFallbackPermalink?: boolean;
    inputCheckoutUrl?: string | null;
    outputUrl?: string | null;
  },
): void {
  const checkout = analyzeCheckoutUrl(detail.checkoutUrl);
  const storeCheckout = analyzeCheckoutUrl(detail.storeCheckoutUrl);
  const primary = analyzeCheckoutUrl(detail.url ?? detail.checkoutUrl ?? detail.storeCheckoutUrl);

  logShopifyRedirectTrace({
    event,
    originalUrl: primary.url,
    redirectedUrl: null,
    hostChanged: false,
    redirectCount: 0,
    checkoutUrl: checkout.url,
    storeCheckoutUrl: storeCheckout.url,
    host: primary.host,
    isShopApp: primary.isShopApp,
    queryKeys: primary.queryKeys,
    shopPayRelatedParams: primary.shopPayRelatedParams,
    method: detail.method,
    path: detail.path,
    cartId: detail.cartId ?? null,
    usedResumeUrl: detail.usedResumeUrl,
    usedFallbackPermalink: detail.usedFallbackPermalink,
    inputCheckoutUrl: detail.inputCheckoutUrl ?? detail.checkoutUrl ?? null,
    outputUrl: detail.outputUrl ?? detail.url ?? null,
    ...(checkout.url && checkout.isShopApp !== primary.isShopApp
      ? { checkoutUrlIsShopApp: checkout.isShopApp }
      : {}),
    ...(storeCheckout.url
      ? {
          storeCheckoutUrlHost: storeCheckout.host,
          storeCheckoutUrlIsShopApp: storeCheckout.isShopApp,
          storeCheckoutQueryKeys: storeCheckout.queryKeys,
          storeCheckoutShopPayRelatedParams: storeCheckout.shopPayRelatedParams,
        }
      : {}),
    ...(checkout.url
      ? {
          checkoutUrlHost: checkout.host,
          checkoutUrlIsShopApp: checkout.isShopApp,
          checkoutQueryKeys: checkout.queryKeys,
          checkoutShopPayRelatedParams: checkout.shopPayRelatedParams,
        }
      : {}),
  });
}

export function logShopifyRedirectTraceNavigation(
  redirectedUrl: string,
  options?: { loading?: boolean; event?: ShopifyRedirectTraceEvent },
): void {
  const nextUrl = trimUrl(redirectedUrl);
  if (!nextUrl) return;

  const previousUrl = lastNavigationUrl;
  if (!sessionOriginalUrl) {
    sessionOriginalUrl = nextUrl;
  }

  const hostChanged =
    previousUrl != null && parseHost(previousUrl) !== parseHost(nextUrl);

  if (previousUrl && previousUrl !== nextUrl) {
    redirectCount += 1;
  }

  const analysis = analyzeCheckoutUrl(nextUrl);

  logShopifyRedirectTrace({
    event: options?.event ?? 'webview_navigation',
    originalUrl: sessionOriginalUrl,
    redirectedUrl: nextUrl,
    hostChanged,
    redirectCount,
    loading: options?.loading,
    host: analysis.host,
    isShopApp: analysis.isShopApp,
    queryKeys: analysis.queryKeys,
    shopPayRelatedParams: analysis.shopPayRelatedParams,
    previousUrl,
  });

  lastNavigationUrl = nextUrl;
}
