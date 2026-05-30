import {
  kokobayCustomerForgotPassword,
  kokobayCustomerLogin,
  kokobayCustomerLogout,
  kokobayCustomerMe,
  kokobayCustomerSignup,
} from '@/services/kokobay-web/customer-auth';
import { persistCustomerSessionCookie } from '@/services/kokobay-web/customer-session';

import type { AuthResult, IAuthService, PasswordResetResult, RegisterInput } from './types';

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

  async restoreSession() {
    const result = await kokobayCustomerMe();
    return result?.ok ? result.session : null;
  },

  async logout(): Promise<void> {
    await kokobayCustomerLogout();
    await persistCustomerSessionCookie(null);
  },
};
