import { getAuthService } from '@/services/auth';
import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import { loadPersistedSession } from '@/store/auth-persist';

import { resolveRestoreOutcome } from './auth-machine';
import type { AuthRestoreOutcome } from './types';

/**
 * Restore auth without side effects — only determines session state.
 * Network failures with a local session → `authenticated_offline`.
 */
export async function restoreAuthSession(): Promise<AuthRestoreOutcome> {
  try {
    const localSession = await loadPersistedSession();

    if (!isKokobayWebProductsConfigured()) {
      if (localSession) {
        return { kind: 'authenticated_offline', session: localSession };
      }
      return { kind: 'unauthenticated' };
    }

    const restored = await getAuthService().restoreSession();
    return resolveRestoreOutcome(restored, localSession);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not restore your session';
    return { kind: 'error', message };
  }
}
