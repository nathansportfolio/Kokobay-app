import * as SecureStore from 'expo-secure-store';

import type { WishlistEntry } from '@/types/wishlist';

const STORAGE_KEY_V1 = 'kokobay_wishlist_handles_v1';
const STORAGE_KEY = 'kokobay_wishlist_v2';

function isHandle(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function isAddedAt(x: unknown): x is string {
  return typeof x === 'string' && !Number.isNaN(Date.parse(x));
}

/** Preserve stored order; drop blanks and duplicates (first occurrence wins). */
export function normalizeWishlistHandles(handles: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of handles) {
    if (!isHandle(raw)) continue;
    const handle = raw.trim();
    if (seen.has(handle)) continue;
    seen.add(handle);
    out.push(handle);
  }
  return out;
}

function parseWishlistEntry(raw: unknown): WishlistEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as { handle?: unknown; addedAt?: unknown };
  if (!isHandle(record.handle)) return null;
  const handle = record.handle.trim();
  const addedAt = isAddedAt(record.addedAt) ? record.addedAt : new Date().toISOString();
  return { handle, addedAt };
}

/** Newest first; drop invalid rows and duplicate handles (first wins). */
export function normalizeWishlistEntries(entries: readonly unknown[]): WishlistEntry[] {
  const seen = new Set<string>();
  const out: WishlistEntry[] = [];
  for (const raw of entries) {
    const entry = parseWishlistEntry(raw);
    if (!entry || seen.has(entry.handle)) continue;
    seen.add(entry.handle);
    out.push(entry);
  }
  return out;
}

export function wishlistHandlesFromEntries(entries: readonly WishlistEntry[]): string[] {
  return entries.map((entry) => entry.handle);
}

/** Legacy v1 rows → entries; preserve list order with synthetic staggered timestamps. */
function migrateHandlesToEntries(handles: string[]): WishlistEntry[] {
  const base = Date.now();
  return handles.map((handle, index) => ({
    handle,
    addedAt: new Date(base - index).toISOString(),
  }));
}

async function loadLegacyWishlistHandles(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY_V1);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeWishlistHandles(parsed);
  } catch {
    return [];
  }
}

export async function loadWishlistEntries(): Promise<WishlistEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeWishlistEntries(parsed);
      }
    }
  } catch {
    // fall through to v1 migration
  }

  const legacyHandles = await loadLegacyWishlistHandles();
  if (!legacyHandles.length) return [];

  const migrated = migrateHandlesToEntries(legacyHandles);
  await persistWishlistEntries(migrated);
  return migrated;
}

export async function loadWishlistHandles(): Promise<string[]> {
  const entries = await loadWishlistEntries();
  return wishlistHandlesFromEntries(entries);
}

export async function persistWishlistEntries(entries: WishlistEntry[]): Promise<boolean> {
  try {
    const normalized = normalizeWishlistEntries(entries);
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export async function persistWishlistHandles(handles: string[]): Promise<boolean> {
  const now = new Date().toISOString();
  return persistWishlistEntries(handles.map((handle, index) => ({
    handle,
    addedAt: new Date(Date.now() - index).toISOString(),
  })));
}
