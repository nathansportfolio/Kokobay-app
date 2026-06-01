import type { AuthSession, AuthUser } from '@/types/auth';

export type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type AuthSuccess = {
  ok: true;
  session: AuthSession;
};

export type AuthFailure = {
  ok: false;
  error: string;
  code?: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type PasswordResetResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

export type RestoreSessionResult =
  | { status: 'ok'; session: AuthSession }
  | { status: 'session_invalid' }
  | { status: 'session_unknown' }
  | { status: 'no_session' };

/**
 * Pluggable auth — Koko Bay customer API by default; swap for Shopify Customer Account API when ready.
 * Keep methods async to match network I/O.
 */
export type IAuthService = {
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  /**
   * Validate or refresh server session (Koko Bay `/api/customer/auth/me`).
   * `session_unknown` means network/server failure — keep local credentials.
   * `session_invalid` means the server rejected the token — clear credentials.
   */
  restoreSession: () => Promise<RestoreSessionResult>;
  logout: () => Promise<void>;
};

/** Narrow user for consumers that only need public fields */
export type { AuthUser, AuthSession };
