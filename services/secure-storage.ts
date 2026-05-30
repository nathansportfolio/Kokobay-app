import * as SecureStore from 'expo-secure-store';

/** @deprecated Legacy demo token — prefer `useAuthStore` + `store/auth-persist` session */
const TOKEN_KEY = 'kokobay_auth_token';

export async function setSecureToken(value: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, value);
}

export async function getSecureToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearSecureToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* no key */
  }
}
