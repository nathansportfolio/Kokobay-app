import type { AuthResult, IAuthService, PasswordResetResult, RegisterInput } from '@/services/auth/types';

/**
 * Placeholder for Shopify Customer Account API / Headless customer flows.
 * Replace implementation and select via `getAuthService('shopify_customer')` when ready.
 */
export function createShopifyCustomerAuthService(_config: {
  shopDomain: string;
  /** storefront API or dedicated customer endpoint — wire as needed */
}): IAuthService {
  return {
    async login(): Promise<AuthResult> {
      return {
        ok: false,
        error: 'Shopify customer authentication is not configured yet.',
        code: 'not_implemented',
      };
    },
    async register(_input: RegisterInput): Promise<AuthResult> {
      return {
        ok: false,
        error: 'Shopify customer registration is not configured yet.',
        code: 'not_implemented',
      };
    },
    async restoreSession() {
      return { status: 'no_session' as const };
    },

    async logout(): Promise<void> {
      /* not configured */
    },

    async requestPasswordReset(_email: string): Promise<PasswordResetResult> {
      return {
        ok: false,
        error: 'Shopify password reset is not configured yet.',
        code: 'not_implemented',
      };
    },
  };
}
