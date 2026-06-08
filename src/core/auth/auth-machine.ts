import type { AuthSession } from '@/types/auth';
import type { RestoreSessionResult } from '@/services/auth/types';

import type { AuthRestoreOutcome, AuthStatus } from './types';
import { isAuthenticatedStatus } from './types';

export function resolveRestoreOutcome(
  restored: RestoreSessionResult,
  localSession: AuthSession | null,
): AuthRestoreOutcome {
  if (restored.status === 'ok') {
    return { kind: 'authenticated', session: restored.session };
  }

  if (restored.status === 'session_unknown') {
    if (localSession) {
      return { kind: 'authenticated_offline', session: localSession };
    }
    return { kind: 'unauthenticated' };
  }

  if (restored.status === 'session_invalid') {
    return { kind: 'unauthenticated' };
  }

  // no_session
  if (localSession) {
    return { kind: 'authenticated_offline', session: localSession };
  }

  return { kind: 'unauthenticated' };
}

export function sessionStateFromRestoreOutcome(outcome: AuthRestoreOutcome): {
  status: AuthStatus;
  user: AuthSession['user'] | null;
  accessToken: string | null;
  errorMessage: string | null;
} {
  switch (outcome.kind) {
    case 'authenticated':
      return {
        status: 'AUTHENTICATED',
        user: outcome.session.user,
        accessToken: outcome.session.accessToken,
        errorMessage: null,
      };
    case 'authenticated_offline':
      return {
        status: 'AUTHENTICATED_OFFLINE',
        user: outcome.session.user,
        accessToken: outcome.session.accessToken,
        errorMessage: null,
      };
    case 'unauthenticated':
      return {
        status: 'UNAUTHENTICATED',
        user: null,
        accessToken: null,
        errorMessage: null,
      };
    case 'error':
      return {
        status: 'ERROR',
        user: null,
        accessToken: null,
        errorMessage: outcome.message,
      };
  }
}

export function sessionStateFromLogin(session: AuthSession): {
  status: AuthStatus;
  user: AuthSession['user'];
  accessToken: string;
  errorMessage: null;
} {
  return {
    status: 'AUTHENTICATED',
    user: session.user,
    accessToken: session.accessToken,
    errorMessage: null,
  };
}

export function unauthenticatedState(): {
  status: AuthStatus;
  user: null;
  accessToken: null;
  errorMessage: null;
} {
  return {
    status: 'UNAUTHENTICATED',
    user: null,
    accessToken: null,
    errorMessage: null,
  };
}

export function shouldRunPostAuthEffects(
  prevStatus: AuthStatus,
  nextStatus: AuthStatus,
  prevUserId: string | null | undefined,
  nextUserId: string | null | undefined,
): boolean {
  if (!isAuthenticatedStatus(nextStatus) || !nextUserId) return false;
  if (!isAuthenticatedStatus(prevStatus)) return true;
  return prevUserId !== nextUserId;
}
