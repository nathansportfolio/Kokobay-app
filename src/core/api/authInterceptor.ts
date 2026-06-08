import { KOKOBAY_PRODUCTS_API_KEY_HEADER } from '@/constants/kokobay-web';
import { KOKOBAY_CUSTOMER_SESSION_COOKIE } from '@/constants/kokobay-cookies';
import { patchAndroidEmulatorLocalhost } from '@/lib/dev-android-network';
import { resolveKokobayApiBaseUrl } from '@/services/kokobay-web/api-config';
import {
  buildKokobayCustomerAuthHeaders,
  resolveActiveCustomerSessionToken,
} from '@/services/kokobay-web/customer-session';
import { isSessionInvalidCode } from '@/services/kokobay-web/customer-auth-shared';
import { getShopifyCountryCode, getShopifyCurrencyCode } from '@/services/shopify/market-context';

import type { ApiAuthMode, ApiHttpMethod } from './types';

export { getApiAuthLifecycle, registerApiAuthLifecycle } from './auth-lifecycle';
export { refreshAuthSession } from '@/src/core/auth/refresh-customer-session';
export { extractSessionTokenFromResponse } from './session-token';

function productsApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_KOKOBAY_PRODUCTS_API_KEY?.trim() || undefined;
}

export function resolveApiBaseUrl(): string {
  const root = patchAndroidEmulatorLocalhost(resolveKokobayApiBaseUrl());
  if (!root) {
    throw new Error('Koko Bay API is not configured');
  }
  return root;
}

export function buildApiUrl(path: string, marketQuery: boolean): string {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const root = resolveApiBaseUrl();
  if (!marketQuery) return `${root}${safePath}`;

  const country = getShopifyCountryCode();
  const currency = getShopifyCurrencyCode();
  if (!country && !currency) return `${root}${safePath}`;

  const sep = safePath.includes('?') ? '&' : '?';
  const params = new URLSearchParams();
  if (country) {
    params.set('country', country);
    params.set('countryCode', country);
  }
  if (currency) {
    params.set('currency', currency);
    params.set('currencyCode', currency);
  }
  return `${root}${safePath}${sep}${params.toString()}`;
}

export type GuestAuthOptions = {
  guestIdOverride?: string;
  includeGuestCart?: boolean;
};

export async function buildRequestAuthHeaders(
  auth: ApiAuthMode,
  sessionOverride?: string,
  guestOptions?: GuestAuthOptions,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = productsApiKey();
  if (apiKey) {
    headers[KOKOBAY_PRODUCTS_API_KEY_HEADER] = apiKey;
  }

  if (auth === 'none') return headers;

  if (auth === 'guest-cart') {
    const guestHeaders = await buildKokobayCustomerAuthHeaders(undefined, {
      includeGuestCart: guestOptions?.includeGuestCart ?? true,
      guestIdOverride: guestOptions?.guestIdOverride,
    });
    if (guestHeaders.Cookie) headers.Cookie = guestHeaders.Cookie;
    return headers;
  }

  if (auth === 'active-customer') {
    const token = sessionOverride?.trim() || (await resolveActiveCustomerSessionToken());
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers.Cookie = `${KOKOBAY_CUSTOMER_SESSION_COOKIE}=${token}`;
    }
    return headers;
  }

  const customerHeaders = await buildKokobayCustomerAuthHeaders(sessionOverride, {
    includeGuestCart: guestOptions?.includeGuestCart ?? true,
    guestIdOverride: guestOptions?.guestIdOverride,
  });
  return { ...headers, ...customerHeaders };
}

export function shouldAttemptAuthRefresh(
  auth: ApiAuthMode,
  status: number,
  body: Record<string, unknown> | null,
): boolean {
  if (auth === 'none' || auth === 'guest-cart') return false;
  if (status !== 401 && status !== 403) return false;
  const code = typeof body?.code === 'string' ? body.code : undefined;
  return isSessionInvalidCode(code) || status === 401;
}

export function mergeRequestHeaders(
  base: Record<string, string>,
  extra?: Record<string, string>,
  method?: ApiHttpMethod,
  hasBody?: boolean,
): Record<string, string> {
  const merged = { ...base, ...extra };
  if (hasBody && method !== 'GET' && !merged['Content-Type']) {
    merged['Content-Type'] = 'application/json';
  }
  return merged;
}
