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

/**
 * Pluggable auth — Koko Bay customer API by default; swap for Shopify Customer Account API when ready.
 * Keep methods async to match network I/O.
 */
export type IAuthService = {
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  /** Validate or refresh server session (Koko Bay `/api/customer/auth/me`). */
  restoreSession: () => Promise<AuthSession | null>;
  logout: () => Promise<void>;
};

/** Narrow user for consumers that only need public fields */
export type { AuthUser, AuthSession };
