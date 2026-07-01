import * as SecureStore from 'expo-secure-store';

import { shopifyVariantKey } from '@/utils/shopify-variant-key';

const STORAGE_KEY = 'kokobay_back_in_stock_v1';

type BackInStockRecord = {
  variantKey: string;
  email: string;
  customerId?: string;
};

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRecord(x: unknown): x is BackInStockRecord {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.variantKey === 'string' && typeof o.email === 'string';
}

async function loadRecords(): Promise<BackInStockRecord[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

async function saveRecords(records: BackInStockRecord[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* ignore SecureStore failures */
  }
}

export async function markBackInStockSubscribed(input: {
  variantId: string;
  email: string;
  customerId?: string;
}): Promise<void> {
  const email = normEmail(input.email);
  if (!email) return;
  const variantKey = shopifyVariantKey(input.variantId);
  const records = await loadRecords();
  const next = records.filter(
    (r) => !(r.variantKey === variantKey && normEmail(r.email) === email),
  );
  next.push({
    variantKey,
    email,
    ...(input.customerId?.trim() ? { customerId: input.customerId.trim() } : {}),
  });
  await saveRecords(next);
}

export async function hasLocalBackInStockSubscription(input: {
  variantId: string;
  email?: string;
  customerId?: string;
}): Promise<boolean> {
  const variantKey = shopifyVariantKey(input.variantId);
  const email = input.email?.trim() ? normEmail(input.email) : '';
  const customerId = input.customerId?.trim() ?? '';
  const records = await loadRecords();
  return records.some((r) => {
    if (r.variantKey !== variantKey) return false;
    if (customerId && r.customerId === customerId) return true;
    if (email && normEmail(r.email) === email) return true;
    return false;
  });
}

/** Email saved locally for a variant — used to prefill guest alerts and restore CTA state. */
export async function getLocalBackInStockEmailForVariant(variantId: string): Promise<string | null> {
  const variantKey = shopifyVariantKey(variantId);
  const records = await loadRecords();
  const match = records.find((r) => r.variantKey === variantKey);
  return match?.email?.trim() ? match.email.trim() : null;
}

/** Most recently used guest alert email on this device. */
export async function getMostRecentLocalBackInStockEmail(): Promise<string | null> {
  const records = await loadRecords();
  const last = records[records.length - 1];
  return last?.email?.trim() ? last.email.trim() : null;
}

export async function clearLocalBackInStockSubscription(input: {
  variantId: string;
  email?: string;
}): Promise<void> {
  const variantKey = shopifyVariantKey(input.variantId);
  const email = input.email?.trim() ? normEmail(input.email) : '';
  const records = await loadRecords();
  const next = records.filter((r) => {
    if (r.variantKey !== variantKey) return true;
    if (!email) return false;
    return normEmail(r.email) !== email;
  });
  await saveRecords(next);
}
