import type { AuthSession } from '@/types/auth';

import {
  api,
  isApiError,
  legacyApiErrorBody,
  legacyTransportReason,
} from '@/src/core/api';
import { refreshCustomerSession } from '@/src/core/auth/refresh-customer-session';

import { isKokobayWebProductsConfigured } from './client';
import {
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

const RESTORE_REQUEST_OPTS = {
  auth: 'customer' as const,
  marketQuery: false,
  skipAuthRefresh: true,
  retries: 0,
  coalesce: false,
};

async function customerAuthRestoreFetch(
  method: 'GET' | 'POST',
  path: string,
  sessionOverride?: string,
): Promise<RestoreFetchResult> {
  try {
    const response =
      method === 'GET'
        ? await api.get(path, { ...RESTORE_REQUEST_OPTS, sessionOverride })
        : await api.post(path, undefined, { ...RESTORE_REQUEST_OPTS, sessionOverride });

    const data = response.data as Record<string, unknown>;
    if (data?.ok === true) {
      return {
        kind: 'success',
        status: response.status,
        data,
        sessionCookie: response.sessionToken,
      };
    }

    const failure = classifyHttpRestoreResponse(response.status, data, false);
    if (failure?.kind === 'session_invalid') return failure;
    if (failure) return failure;

    return { kind: 'session_unknown', reason: 'server', status: response.status };
  } catch (error) {
    if (isApiError(error) && error.kind === 'configuration') {
      return { kind: 'session_unknown', reason: 'server' };
    }

    if (isApiError(error) && error.kind === 'http') {
      const data = legacyApiErrorBody(error);
      const parseFailed = data === null;
      const failure = classifyHttpRestoreResponse(error.status ?? 0, data, parseFailed);
      if (failure?.kind === 'session_invalid') return failure;
      if (failure) return failure;
      return { kind: 'session_unknown', reason: 'server', status: error.status };
    }

    return { kind: 'session_unknown', reason: legacyTransportReason(error) };
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
  const refreshed = await refreshCustomerSession(existing);

  if (refreshed.status === 'session_invalid') {
    return { status: 'session_invalid' };
  }
  if (refreshed.status === 'session_unknown') {
    return { status: 'session_unknown', reason: refreshed.reason };
  }

  const refreshedToken = refreshed.token;

  const direct = meSuccessFromPayload(refreshed.data, refreshed.sessionCookie, refreshedToken);
  if (direct) return direct;

  const retry = await customerAuthRestoreFetch('GET', '/api/customer/auth/me', refreshedToken);
  if (retry.kind === 'success') {
    const ok = meSuccessFromPayload(retry.data, retry.sessionCookie, refreshedToken);
    if (ok) return ok;
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
