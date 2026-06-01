import * as SecureStore from 'expo-secure-store';

import {
  KOKOBAY_CART_GUEST_COOKIE,
  KOKOBAY_CUSTOMER_SESSION_COOKIE,
} from '@/constants/kokobay-cookies';
import { getInMemoryCustomerSessionToken } from '@/services/kokobay-web/customer-session-reader';
import { loadPersistedSession } from '@/store/auth-persist';
import { loadCartGuestId } from '@/store/cart-persist';

export { KOKOBAY_CUSTOMER_SESSION_COOKIE } from '@/constants/kokobay-cookies';

const SESSION_COOKIE_KEY = 'kokobay_customer_session_v1';

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookieValue(setCookieLine: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`);
  const match = setCookieLine.match(pattern);
  return match?.[1]?.trim() ? decodeCookieValue(match[1].trim()) : null;
}

/** Parse `kokobay_customer_session` from response `Set-Cookie` headers (RN-safe). */
export function extractCustomerSessionFromHeaders(headers: Headers): string | null {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    for (const line of withGetSetCookie.getSetCookie()) {
      const value = parseCookieValue(line, KOKOBAY_CUSTOMER_SESSION_COOKIE);
      if (value) return value;
    }
  }

  const candidates: string[] = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      candidates.push(value);
    }
  });

  const combined = headers.get('set-cookie') ?? headers.get('Set-Cookie');
  if (combined) candidates.push(combined);

  for (const line of candidates) {
    const value = parseCookieValue(line, KOKOBAY_CUSTOMER_SESSION_COOKIE);
    if (value) return value;
  }

  return null;
}

/** Optional future field when login JSON includes the JWT for mobile clients. */
export function extractCustomerSessionFromBody(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const token = data.sessionToken;
  if (typeof token === 'string' && token.trim()) {
    return token.trim();
  }
  return null;
}

export async function loadCustomerSessionCookie(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export async function persistCustomerSessionCookie(value: string | null): Promise<void> {
  try {
    if (!value?.trim()) {
      await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
      return;
    }
    await SecureStore.setItemAsync(SESSION_COOKIE_KEY, value.trim());
  } catch {
    /* persist best-effort */
  }
}

/** Session token sent as Bearer — Kokobay JWT or Shopify customer access token (server accepts both). */
export function isLikelyKokobaySessionToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (t.startsWith('eyJ') && t.includes('.')) return true;
  if (t.startsWith('shpua_') || t.startsWith('shpat_')) return true;
  return t.length >= 16;
}

/** Best available Koko Bay session JWT: in-memory auth state, SecureStore, then auth persist. */
export async function resolveCustomerSessionToken(sessionOverride?: string): Promise<string | null> {
  const candidates = [
    sessionOverride?.trim(),
    getInMemoryCustomerSessionToken(),
    await loadCustomerSessionCookie(),
    (await loadPersistedSession())?.accessToken?.trim(),
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }

  return null;
}

/**
 * Auth headers for Koko Bay customer APIs in React Native.
 * Sends Bearer (recommended for RN) plus Cookie when a session exists.
 */
export async function buildKokobayCustomerAuthHeaders(
  sessionOverride?: string,
  options?: { guestIdOverride?: string; includeGuestCart?: boolean },
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const session = await resolveCustomerSessionToken(sessionOverride);

  if (session) {
    headers.Authorization = `Bearer ${session}`;
  }

  const includeGuestCart = options?.includeGuestCart !== false;
  const cookieParts: string[] = [];
  if (includeGuestCart) {
    const guestId = options?.guestIdOverride?.trim() || (await loadCartGuestId());
    if (guestId) {
      cookieParts.push(`${KOKOBAY_CART_GUEST_COOKIE}=${guestId}`);
    }
  }
  if (session) {
    cookieParts.push(`${KOKOBAY_CUSTOMER_SESSION_COOKIE}=${session}`);
  }
  if (cookieParts.length) {
    headers.Cookie = cookieParts.join('; ');
  }

  return headers;
}

/** @deprecated Prefer {@link buildKokobayCustomerAuthHeaders} */
export async function buildKokobayCartCookieHeader(
  guestIdOverride?: string,
  sessionOverride?: string,
): Promise<string | undefined> {
  const headers = await buildKokobayCustomerAuthHeaders(sessionOverride, {
    guestIdOverride,
    includeGuestCart: true,
  });
  return headers.Cookie;
}

/** @deprecated Prefer {@link buildKokobayCustomerAuthHeaders} */
export async function buildKokobayAuthCookieHeader(sessionOverride?: string): Promise<string | undefined> {
  const headers = await buildKokobayCustomerAuthHeaders(sessionOverride, {
    includeGuestCart: true,
  });
  return headers.Cookie;
}
