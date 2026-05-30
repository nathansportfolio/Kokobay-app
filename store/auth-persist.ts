import * as SecureStore from 'expo-secure-store';

import type { AuthSession } from '@/types/auth';

const SESSION_KEY = 'kokobay_auth_session_v1';

function isAuthSession(x: unknown): x is AuthSession {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.accessToken !== 'string' || o.accessToken.length < 4) return false;
  const u = o.user;
  if (typeof u !== 'object' || u === null) return false;
  const user = u as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string'
  );
}

export async function loadPersistedSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function persistSession(session: AuthSession | null): Promise<void> {
  try {
    if (!session) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return;
    }
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* persist best-effort */
  }
}
