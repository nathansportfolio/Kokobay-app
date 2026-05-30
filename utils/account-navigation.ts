import type { AccountModeParam } from '@/types/account-mode';

type AccountModeRouteParams = {
  mode: AccountModeParam;
  returnTo?: string;
};

export function accountModeRoute(params: AccountModeRouteParams) {
  return {
    pathname: '/account' as const,
    params: {
      mode: params.mode,
      ...(params.returnTo ? { returnTo: params.returnTo } : {}),
    },
  };
}

/** @deprecated use accountModeRoute */
export const accountAuthRoute = accountModeRoute;

export function accountSettingsRoute() {
  return accountModeRoute({ mode: 'settings' });
}
