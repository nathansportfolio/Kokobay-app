import { kokobayCustomerAuthService } from './kokobay-customer-auth-service';
import type { IAuthService } from './types';
import { createShopifyCustomerAuthService } from './shopify-customer-auth';

export type { AuthResult, AuthSession, AuthUser, IAuthService, PasswordResetResult, RegisterInput } from './types';
export { kokobayCustomerAuthService } from './kokobay-customer-auth-service';
export { createShopifyCustomerAuthService } from './shopify-customer-auth';

export type AuthProviderId = 'kokobay_customer' | 'shopify_customer';

/** Koko Bay customer auth via the web API (default). */
export function getAuthService(provider?: AuthProviderId): IAuthService {
  if (provider === 'shopify_customer') {
    return createShopifyCustomerAuthService({ shopDomain: '' });
  }
  return kokobayCustomerAuthService;
}
