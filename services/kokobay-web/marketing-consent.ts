import { api, isApiError, legacyApiErrorBody } from '@/src/core/api';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';

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
  status: number,
  data: Record<string, unknown> | null,
  fallbackError: string,
): MarketingConsentResult {
  if (status >= 200 && status < 300 && data?.success === true && typeof data.subscribed === 'boolean') {
    return { ok: true, subscribed: data.subscribed };
  }

  const code = typeof data?.code === 'string' ? data.code : undefined;
  const error =
    typeof data?.error === 'string'
      ? data.error
      : status === 429
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

  if (!sessionToken?.trim()) {
    return {
      ok: false,
      error: method === 'GET' ? 'Sign in to view email preferences.' : 'Sign in to update email preferences.',
      code: 'unauthorized',
    };
  }

  const requestOpts = {
    auth: 'active-customer' as const,
    sessionOverride: sessionToken,
    includeGuestCart: false,
    marketQuery: false,
    retries: 0,
    coalesce: false,
  };

  try {
    const response =
      method === 'GET'
        ? await api.get('/api/customer/marketing-consent', requestOpts)
        : await api.post('/api/customer/marketing-consent', body, requestOpts);

    return parseMarketingConsentResponse(
      response.status,
      response.data as Record<string, unknown>,
      method === 'GET' ? 'Could not load marketing preferences.' : 'Could not update marketing preferences.',
    );
  } catch (error) {
    if (isApiError(error) && error.kind === 'http') {
      const data = legacyApiErrorBody(error);
      if (!data) {
        return { ok: false, error: 'Unexpected response from the server.' };
      }
      return parseMarketingConsentResponse(
        error.status ?? 0,
        data,
        method === 'GET' ? 'Could not load marketing preferences.' : 'Could not update marketing preferences.',
      );
    }
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
