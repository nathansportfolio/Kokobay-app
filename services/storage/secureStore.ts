import * as SecureStore from 'expo-secure-store';

export async function readFromSecureStore(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writeToSecureStore(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* persist best-effort */
  }
}
