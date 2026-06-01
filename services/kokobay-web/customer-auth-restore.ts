import type { AuthSession } from '@/types/auth';
import { FetchTimeoutError } from '@/utils/fetch-with-timeout';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

import { resolveKokobayApiBaseUrl } from './api-config';
import { isKokobayWebProductsConfigured } from './client';
import {
  buildKokobayCustomerAuthHeaders,
  extractCustomerSessionFromBody,
  extractCustomerSessionFromHeaders,
  persistCustomerSessionCookie,
  resolveCustomerSessionToken,
} from './customer-session';

import type { KokobayAuthOk } from './customer-auth-shared';
import {
  classifyHttpRestoreResponse,
  isSessionInvalidCode,
  resolveSessionToken,
  sessionFromCustomer,
} from './customer-auth-shared';

/**
 * Result of `GET /api/customer/auth/me` during session restore.
 *
 * - `session_invalid` — server confirmed the token is gone (unauthorized / expired).
 * - `session_unknown` — validity could not be checked (network, 5xx, ambiguous 4xx).
 */
export type KokobayCustomerMeResult =
  | { status: 'ok'; session: AuthSession }
  | { status: 'no_local_session' }
  | { status: 'session_invalid' }
  | { status: 'session_unknown'; reason: 'network' | 'timeout' | 'server' | 'offline' };

type RestoreFetchSuccess = {
  kind: 'success';
  status: number;
  data: Record<string, unknown>;
  sessionCookie: string | null;
};

type RestoreFetchSessionInvalid = {
  kind: 'session_invalid';
  status: number;
  code?: string;
};

type RestoreFetchSessionUnknown = {
  kind: 'session_unknown';
  reason: 'network' | 'timeout' | 'server' | 'offline';
  status?: number;
};

type RestoreFetchResult =
  | RestoreFetchSuccess
  | RestoreFetchSessionInvalid
  | RestoreFetchSessionUnknown;

function classifyTransportError(error: unknown): 'network' | 'timeout' | 'offline' {
  if (error instanceof FetchTimeoutError) return 'timeout';
  if (error instanceof TypeError) return 'network';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('network request failed') || message.includes('failed to fetch')) {
    return 'offline';
  }
  return 'network';
}

async function customerAuthRestoreFetch(
  method: 'GET' | 'POST',
  path: string,
  sessionOverride?: string,
): Promise<RestoreFetchResult> {
  const root = resolveKokobayApiBaseUrl();
  if (!root) {
    return { kind: 'session_unknown', reason: 'server' };
  }

  const url = `${root}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = await buildKokobayCustomerAuthHeaders(sessionOverride, { includeGuestCart: true });
  if (method === 'POST') headers['Content-Type'] = 'application/json';

  try {
    const res = await fetchWithTimeout(url, { method, headers });
    const sessionCookie = extractCustomerSessionFromHeaders(res.headers);
    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    let parseFailed = false;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parseFailed = true;
      data = null;
    }

    if (res.ok && data?.ok === true) {
      const sessionFromBody = extractCustomerSessionFromBody(data);
      return {
        kind: 'success',
        status: res.status,
        data,
        sessionCookie: sessionCookie ?? sessionFromBody,
      };
    }

    const failure = classifyHttpRestoreResponse(res.status, data, parseFailed);
    if (failure?.kind === 'session_invalid') return failure;
    if (failure) return failure;

    return { kind: 'session_unknown', reason: 'server', status: res.status };
  } catch (error) {
    return { kind: 'session_unknown', reason: classifyTransportError(error) };
  }
}

function meSuccessFromPayload(
  data: Record<string, unknown>,
  sessionCookie: string | null,
  existingToken: string,
): Extract<KokobayCustomerMeResult, { status: 'ok' }> | null {
  const customer = (data as KokobayAuthOk).customer;
  if (!customer?.id || !customer.email) return null;
  const token = resolveSessionToken(data, sessionCookie) ?? existingToken;
  return { status: 'ok', session: sessionFromCustomer(customer, token) };
}

async function tryRefreshSession(existing: string): Promise<KokobayCustomerMeResult | null> {
  const refreshed = await customerAuthRestoreFetch('POST', '/api/customer/auth/refresh', existing);

  if (refreshed.kind === 'session_invalid') {
    return { status: 'session_invalid' };
  }
  if (refreshed.kind === 'session_unknown') {
    return { status: 'session_unknown', reason: refreshed.reason };
  }

  const refreshedToken =
    resolveSessionToken(refreshed.data, refreshed.sessionCookie) ?? refreshed.sessionCookie;
  if (refreshedToken) await persistCustomerSessionCookie(refreshedToken);

  const direct = meSuccessFromPayload(refreshed.data, refreshed.sessionCookie, refreshedToken ?? existing);
  if (direct) return direct;

  const retry = await customerAuthRestoreFetch(
    'GET',
    '/api/customer/auth/me',
    refreshedToken ?? existing,
  );
  if (retry.kind === 'success') {
    const ok = meSuccessFromPayload(retry.data, retry.sessionCookie, refreshedToken ?? existing);
    if (ok) {
      if (ok.session.accessToken !== existing) {
        await persistCustomerSessionCookie(ok.session.accessToken);
      }
      return ok;
    }
  }
  if (retry.kind === 'session_invalid') {
    return { status: 'session_invalid' };
  }
  if (retry.kind === 'session_unknown') {
    return { status: 'session_unknown', reason: retry.reason };
  }

  return { status: 'session_unknown', reason: 'server' };
}

/**
 * Validates the customer session with `GET /api/customer/auth/me`.
 * Network and 5xx failures return `session_unknown` so callers keep the local session.
 */
export async function kokobayCustomerMe(): Promise<KokobayCustomerMeResult> {
  if (!isKokobayWebProductsConfigured()) {
    return { status: 'no_local_session' };
  }

  const existing = await resolveCustomerSessionToken();
  if (!existing) {
    return { status: 'no_local_session' };
  }

  const me = await customerAuthRestoreFetch('GET', '/api/customer/auth/me', existing);

  if (me.kind === 'success') {
    const ok = meSuccessFromPayload(me.data, me.sessionCookie, existing);
    if (ok) {
      if (ok.session.accessToken !== existing) {
        await persistCustomerSessionCookie(ok.session.accessToken);
      }
      return ok;
    }
    return { status: 'session_unknown', reason: 'server' };
  }

  if (me.kind === 'session_unknown') {
    return { status: 'session_unknown', reason: me.reason };
  }

  // Server explicitly rejected the session — try refresh before clearing.
  const code = me.code ?? (me.status === 401 ? 'unauthorized' : undefined);
  if (isSessionInvalidCode(code) || me.status === 401 || me.status === 403) {
    const refreshed = await tryRefreshSession(existing);
    if (refreshed?.status === 'ok') return refreshed;
    if (refreshed?.status === 'session_unknown') return refreshed;

    await persistCustomerSessionCookie(null);
    return { status: 'session_invalid' };
  }

  return { status: 'session_invalid' };
}
