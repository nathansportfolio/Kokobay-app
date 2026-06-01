import { resolveKokobayApiBaseUrl } from '@/services/kokobay-web/api-config';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { buildKokobayCustomerAuthHeaders } from '@/services/kokobay-web/customer-session';

export type MarketingConsentResult =
  | { ok: true; subscribed: boolean }
  | { ok: false; error: string; code?: string };

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Your session has expired. Please sign in again.',
  rate_limited: 'Too many requests. Please wait and try again.',
  invalid_request: 'Could not update marketing preferences.',
  invalid_json: 'Could not update marketing preferences.',
  body_too_large: 'Could not update marketing preferences.',
  internal_error: 'Could not load marketing preferences.',
};

/** Avoid hammering GET /marketing-consent (60/hr per customer on API). */
const GET_CACHE_TTL_MS = 5 * 60_000;

let marketingConsentCache: {
  sessionKey: string;
  subscribed: boolean;
  fetchedAt: number;
} | null = null;

function sessionCacheKey(sessionToken?: string | null): string {
  return sessionToken?.trim() || '';
}

function friendlyError(error: string, code?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return error.trim() || 'Could not update marketing preferences.';
}

function parseMarketingConsentResponse(
  res: Response,
  data: Record<string, unknown> | null,
  fallbackError: string,
): MarketingConsentResult {
  if (res.ok && data?.success === true && typeof data.subscribed === 'boolean') {
    return { ok: true, subscribed: data.subscribed };
  }

  const code = typeof data?.code === 'string' ? data.code : undefined;
  const error =
    typeof data?.error === 'string'
      ? data.error
      : res.status === 429
        ? 'Too many requests'
        : fallbackError;
  return { ok: false, error: friendlyError(error, code), code };
}

function readCachedConsent(sessionToken?: string | null): MarketingConsentResult | null {
  const key = sessionCacheKey(sessionToken);
  if (!key || !marketingConsentCache) return null;
  if (marketingConsentCache.sessionKey !== key) return null;
  if (Date.now() - marketingConsentCache.fetchedAt > GET_CACHE_TTL_MS) return null;
  return { ok: true, subscribed: marketingConsentCache.subscribed };
}

function writeCachedConsent(sessionToken: string | null | undefined, subscribed: boolean): void {
  const key = sessionCacheKey(sessionToken);
  if (!key) return;
  marketingConsentCache = {
    sessionKey: key,
    subscribed,
    fetchedAt: Date.now(),
  };
}

export function invalidateMarketingConsentCache(): void {
  marketingConsentCache = null;
}

async function marketingConsentRequest(
  method: 'GET' | 'POST',
  sessionToken: string | null | undefined,
  body?: { subscribed: boolean },
): Promise<MarketingConsentResult> {
  if (!isKokobayWebProductsConfigured()) {
    return { ok: false, error: 'Account services are not configured.' };
  }

  const root = resolveKokobayApiBaseUrl();
  if (!root) {
    return { ok: false, error: 'Account services are not configured.' };
  }

  const headers = await buildKokobayCustomerAuthHeaders(sessionToken ?? undefined, {
    includeGuestCart: false,
  });

  if (!headers.Authorization) {
    return {
      ok: false,
      error: method === 'GET' ? 'Sign in to view email preferences.' : 'Sign in to update email preferences.',
      code: 'unauthorized',
    };
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetchWithTimeout(`${root}/api/customer/marketing-consent`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'Unexpected response from the server.' };
    }

    return parseMarketingConsentResponse(
      res,
      data,
      method === 'GET' ? 'Could not load marketing preferences.' : 'Could not update marketing preferences.',
    );
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' };
  }
}

/** GET /api/customer/marketing-consent — Admin marketingState (source of truth). */
export async function fetchCustomerMarketingConsent(
  sessionToken?: string | null,
  options?: { force?: boolean },
): Promise<MarketingConsentResult> {
  if (!options?.force) {
    const cached = readCachedConsent(sessionToken);
    if (cached) return cached;
  }

  const result = await marketingConsentRequest('GET', sessionToken);
  if (result.ok) {
    writeCachedConsent(sessionToken, result.subscribed);
  }
  return result;
}

/** POST /api/customer/marketing-consent — Bearer session; no CSRF on mobile. */
export async function updateCustomerMarketingConsent(
  subscribed: boolean,
  sessionToken?: string | null,
): Promise<MarketingConsentResult> {
  const result = await marketingConsentRequest('POST', sessionToken, { subscribed });
  if (result.ok) {
    writeCachedConsent(sessionToken, result.subscribed);
  }
  return result;
}
