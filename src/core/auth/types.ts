import type { AuthSession, AuthUser } from '@/types/auth';

export type AuthStatus =
  | 'UNAUTHENTICATED'
  | 'RESTORING'
  | 'AUTHENTICATED'
  | 'AUTHENTICATED_OFFLINE'
  | 'ERROR';

/** Screen-facing auth snapshot — no tokens. */
export type AuthView = {
  status: AuthStatus;
  user: AuthUser | null;
  errorMessage: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
};

export type AuthRestoreOutcome =
  | { kind: 'authenticated'; session: AuthSession }
  | { kind: 'authenticated_offline'; session: AuthSession }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string };

export function isAuthenticatedStatus(status: AuthStatus): boolean {
  return status === 'AUTHENTICATED' || status === 'AUTHENTICATED_OFFLINE';
}

export function isAuthReady(status: AuthStatus): boolean {
  return status !== 'RESTORING';
}

export function authViewFromState(input: {
  status: AuthStatus;
  user: AuthUser | null;
  errorMessage: string | null;
}): AuthView {
  return {
    status: input.status,
    user: input.user,
    errorMessage: input.errorMessage,
    isAuthenticated: isAuthenticatedStatus(input.status) && input.user != null,
    isReady: isAuthReady(input.status),
  };
}
