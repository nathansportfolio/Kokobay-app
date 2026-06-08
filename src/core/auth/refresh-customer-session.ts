import {
  classifyHttpRestoreResponse,
  isSessionInvalidCode,
} from '@/services/kokobay-web/customer-auth-shared';
import {
  persistCustomerSessionCookie,
  resolveCustomerSessionToken,
} from '@/services/kokobay-web/customer-session';

import { getApiAuthLifecycle } from '@/src/core/api/auth-lifecycle';
import { isApiError, legacyApiErrorBody, legacyTransportReason } from '@/src/core/api/errorHandler';
import { requestQueue } from '@/src/core/api/requestQueue';
import { extractSessionTokenFromResponse } from '@/src/core/api/session-token';

import {
  refreshCustomerSessionWithDeps,
  type RefreshCustomerSessionDeps,
  type RefreshCustomerSessionResult,
} from './refresh-customer-session-runner';

export type { RefreshCustomerSessionDeps, RefreshCustomerSessionResult };
export { refreshCustomerSessionWithDeps };

type RefreshPostOutcome = Awaited<ReturnType<RefreshCustomerSessionDeps['postRefresh']>>;

/** Persist cookie + notify auth engine — single commit path for refresh success. */
export async function commitRefreshedCustomerSession(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;
  await persistCustomerSessionCookie(trimmed);
  getApiAuthLifecycle().onSessionRefreshed?.(trimmed);
}

/** Clear cookie + notify auth engine — single commit path for refresh invalidation. */
export async function commitInvalidCustomerSession(): Promise<void> {
  await persistCustomerSessionCookie(null);
  getApiAuthLifecycle().onSessionInvalid?.();
}

async function postCustomerSessionRefresh(existing: string): Promise<RefreshPostOutcome> {
  try {
    const { api } = await import('@/src/core/api/apiClient');

    const response = await api.post('/api/customer/auth/refresh', undefined, {
      auth: 'customer',
      sessionOverride: existing,
      marketQuery: false,
      skipAuthRefresh: true,
      retries: 0,
      coalesce: false,
    });

    const data = response.data as Record<string, unknown>;
    if (data?.ok === true) {
      const sessionCookie = response.sessionToken;
      const token = extractSessionTokenFromResponse(response.headers, data) ?? existing;
      return {
        kind: 'success',
        token,
        data,
        sessionCookie,
      };
    }

    const failure = classifyHttpRestoreResponse(response.status, data, false);
    if (failure?.kind === 'session_invalid') {
      return { kind: 'session_invalid' };
    }
    if (failure?.kind === 'session_unknown') {
      return { kind: 'session_unknown', reason: failure.reason };
    }

    return { kind: 'session_unknown', reason: 'server' };
  } catch (error) {
    if (isApiError(error) && error.kind === 'configuration') {
      return { kind: 'session_unknown', reason: 'server' };
    }

    if (isApiError(error) && error.kind === 'http') {
      const data = legacyApiErrorBody(error);
      const status = error.status ?? 0;
      const code = typeof data?.code === 'string' ? data.code : undefined;

      if (status === 401 || status === 403 || isSessionInvalidCode(code)) {
        return { kind: 'session_invalid' };
      }

      const failure = classifyHttpRestoreResponse(status, data, data === null);
      if (failure?.kind === 'session_invalid') {
        return { kind: 'session_invalid' };
      }
      if (failure?.kind === 'session_unknown') {
        return { kind: 'session_unknown', reason: failure.reason };
      }

      return { kind: 'session_unknown', reason: 'server' };
    }

    return { kind: 'session_unknown', reason: legacyTransportReason(error) };
  }
}

function defaultRefreshDeps(): RefreshCustomerSessionDeps {
  return {
    resolveExistingToken: (override) => resolveCustomerSessionToken(override),
    postRefresh: postCustomerSessionRefresh,
    commitRefreshedToken: commitRefreshedCustomerSession,
    commitInvalidSession: commitInvalidCustomerSession,
    runSerialized: (fn) => requestQueue.runAuthRefresh(fn),
  };
}

/** Shared refresh implementation for API interceptor and cold-start restore. */
export async function refreshCustomerSession(
  existingToken?: string,
): Promise<RefreshCustomerSessionResult> {
  return refreshCustomerSessionWithDeps(defaultRefreshDeps(), existingToken);
}

/** API interceptor entry — returns new token or null after refresh attempt. */
export async function refreshAuthSession(): Promise<string | null> {
  const result = await refreshCustomerSession();
  if (result.status === 'ok') return result.token;
  return null;
}
