import {
  kokobayCustomerForgotPassword,
  kokobayCustomerLogin,
  kokobayCustomerLogout,
  kokobayCustomerMe,
  kokobayCustomerSignup,
} from '@/services/kokobay-web/customer-auth';
import { persistCustomerSessionCookie } from '@/services/kokobay-web/customer-session';

import type { AuthResult, IAuthService, PasswordResetResult, RegisterInput, RestoreSessionResult } from './types';

export const kokobayCustomerAuthService: IAuthService = {
  async login(email, password): Promise<AuthResult> {
    return kokobayCustomerLogin(email, password);
  },

  async register(input: RegisterInput): Promise<AuthResult> {
    return kokobayCustomerSignup({
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
    });
  },

  async requestPasswordReset(email: string): Promise<PasswordResetResult> {
    return kokobayCustomerForgotPassword(email);
  },

  async restoreSession(): Promise<RestoreSessionResult> {
    const result = await kokobayCustomerMe();
    switch (result.status) {
      case 'ok':
        return { status: 'ok', session: result.session };
      case 'session_invalid':
        return { status: 'session_invalid' };
      case 'session_unknown':
        return { status: 'session_unknown' };
      case 'no_local_session':
        return { status: 'no_session' };
    }
  },

  async logout(): Promise<void> {
    await kokobayCustomerLogout();
    await persistCustomerSessionCookie(null);
  },
};
