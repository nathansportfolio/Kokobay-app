import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'kokobay_wishlist_handles_v1';

function isHandle(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

export async function loadWishlistHandles(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(isHandle).map((h) => h.trim()))];
  } catch {
    return [];
  }
}

export async function persistWishlistHandles(handles: string[]): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(handles));
    return true;
  } catch {
    return false;
  }
}
