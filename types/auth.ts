/** Signed-in customer snapshot (Shopify Customer-compatible shape for future swap) */
export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

/** What we persist in SecureStore — opaque token + user (no password) */
export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};
