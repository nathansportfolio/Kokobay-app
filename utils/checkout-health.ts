const MIN_CHECKOUT_URL_LENGTH = 20;
const INVALID_ESCALATION_WINDOW_MS = 5 * 60_000;
const INVALID_ESCALATION_COUNT = 3;

/** `/cart/{variants}?…checkout=` with an empty checkout query value. */
const BROKEN_CART_CHECKOUT_PATH = /\/cart\/[^?#]+\?[^#]*(?:^|[?&])checkout=(?=&|#|$)/i;

const GENERIC_UNAVAILABLE = {
  title: 'Checkout Temporarily Unavailable',
  message:
    "We're currently experiencing an issue connecting to our checkout provider. Please try again in a few minutes.",
} as const;

const SHOPIFY_OUTAGE_UNAVAILABLE = {
  title: 'Checkout Temporarily Unavailable',
  message: 'Shopify checkout is currently unavailable. Please come back shortly.',
} as const;

let recentInvalidAtMs: number[] = [];

export function logCheckoutHealth(
  status: 'valid' | 'invalid' | 'open_failed',
  detail?: Record<string, unknown>,
): void {
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[CHECKOUT_HEALTH] ${status}`, detail);
    return;
  }
  console.log(`[CHECKOUT_HEALTH] ${status}`);
}

function hasEmptyCheckoutQueryParam(url: string): boolean {
  if (!url.includes('checkout=')) return false;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('checkout')) return false;
    const value = parsed.searchParams.get('checkout');
    return value === '' || value === null;
  } catch {
    return /[?&]checkout=(?=&|#|$)/i.test(url);
  }
}

function matchesBrokenCartCheckoutPermalink(url: string): boolean {
  return BROKEN_CART_CHECKOUT_PATH.test(url);
}

/**
 * Returns false for missing, truncated, or known-broken Shopify cart permalink URLs
 * (e.g. `?checkout=` with no value).
 */
export function isCheckoutAvailable(url?: string | null): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  if (trimmed.length < MIN_CHECKOUT_URL_LENGTH) return false;
  if (hasEmptyCheckoutQueryParam(trimmed)) return false;
  if (matchesBrokenCartCheckoutPermalink(trimmed)) return false;
  if (trimmed.includes('?checkout=') && trimmed.endsWith('=')) return false;
  return true;
}

/** @internal Test-only reset for escalation window state. */
export function resetCheckoutHealthEscalationForTests(): void {
  recentInvalidAtMs = [];
}

export function recordCheckoutHealthInvalid(): void {
  const now = Date.now();
  recentInvalidAtMs = recentInvalidAtMs.filter((t) => now - t < INVALID_ESCALATION_WINDOW_MS);
  recentInvalidAtMs.push(now);
}

export function shouldShowShopifyOutageMessage(): boolean {
  const now = Date.now();
  recentInvalidAtMs = recentInvalidAtMs.filter((t) => now - t < INVALID_ESCALATION_WINDOW_MS);
  return recentInvalidAtMs.length >= INVALID_ESCALATION_COUNT;
}

export function getCheckoutUnavailableCopy(): { title: string; message: string } {
  if (shouldShowShopifyOutageMessage()) {
    return { ...SHOPIFY_OUTAGE_UNAVAILABLE };
  }
  return { ...GENERIC_UNAVAILABLE };
}

export function assertCheckoutAvailable(
  url: string | null | undefined,
  detail?: Record<string, unknown>,
): url is string {
  if (isCheckoutAvailable(url)) {
    logCheckoutHealth('valid', { url, ...detail });
    return true;
  }
  logCheckoutHealth('invalid', { url: url ?? null, ...detail });
  recordCheckoutHealthInvalid();
  return false;
}
