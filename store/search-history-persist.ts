import * as SecureStore from 'expo-secure-store';

const KEY = 'kokobay_search_history_v1';
const MAX_ENTRIES = 14;

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((i) => typeof i === 'string' && i.length > 0 && i.length < 200);
}

export async function loadSearchHistory(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isStringArray(parsed)) return [];
    return parsed.slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export async function persistSearchHistory(entries: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* persist best-effort */
  }
}
