import type { AuthUser } from '@/types/auth';
import { useAuthStore } from '@/store/auth-session';

import { isAuthenticatedStatus } from './types';

/** Services / data hooks — never use in presentational screens. */
export function getAuthAccessToken(): string | undefined {
  const { accessToken, status } = useAuthStore.getState();
  if (!isAuthenticatedStatus(status) || !accessToken?.trim()) return undefined;
  return accessToken;
}

export function getAuthUser(): AuthUser | null {
  const { user, status } = useAuthStore.getState();
  if (!isAuthenticatedStatus(status)) return null;
  return user;
}
