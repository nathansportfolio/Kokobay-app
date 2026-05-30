export type AccountGuestMode = 'landing' | 'signin' | 'signup' | 'forgotPassword' | 'settings';

export type AccountAuthenticatedView = 'dashboard' | 'settings';

export type AccountMode = AccountGuestMode | 'authenticated';

export type AccountModeParam = 'signin' | 'signup' | 'forgotPassword' | 'settings';

export function parseAccountModeParam(value: string | string[] | undefined): AccountGuestMode | null {
  const raw = typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
  if (
    raw === 'signin' ||
    raw === 'signup' ||
    raw === 'forgotPassword' ||
    raw === 'settings'
  ) {
    return raw;
  }
  return null;
}
