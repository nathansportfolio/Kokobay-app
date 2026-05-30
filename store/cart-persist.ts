import * as SecureStore from 'expo-secure-store';

import type { CartLine } from '@/types/cart';

const STORAGE_KEY = 'kokobay_cart_v1';
const SHOPIFY_CART_ID_KEY = 'kokobay_shopify_cart_id_v1';
const CART_GUEST_ID_KEY = 'kokobay_cart_guest_id_v1';

function optionalNullableString(k: string, o: Record<string, unknown>): boolean {
  const v = o[k];
  return v === undefined || v === null || typeof v === 'string';
}

function isMoneySnapshot(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.amount !== 'string' || typeof o.currencyCode !== 'string') return false;
  if (o.currencyCode.length < 3) return false;
  return Number.isFinite(Number.parseFloat(o.amount));
}

function optionalUnitPrice(o: Record<string, unknown>): boolean {
  if (!('unitPrice' in o) || o.unitPrice === undefined || o.unitPrice === null) return true;
  return isMoneySnapshot(o.unitPrice);
}

function isCartLine(x: unknown): x is CartLine {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.handle === 'string' &&
    o.handle.length > 0 &&
    typeof o.variantId === 'string' &&
    o.variantId.length > 0 &&
    typeof o.qty === 'number' &&
    Number.isFinite(o.qty) &&
    o.qty >= 1 &&
    o.qty <= 99 &&
    optionalNullableString('title', o) &&
    optionalNullableString('variantTitle', o) &&
    optionalNullableString('imageUrl', o) &&
    optionalNullableString('shopifyLineId', o) &&
    optionalUnitPrice(o) &&
    optionalMaxQty(o)
  );
}

function optionalMaxQty(o: Record<string, unknown>): boolean {
  if (!('maxQty' in o) || o.maxQty === undefined || o.maxQty === null) return true;
  return typeof o.maxQty === 'number' && Number.isFinite(o.maxQty) && o.maxQty >= 1 && o.maxQty <= 99;
}

export async function loadPersistedCart(): Promise<CartLine[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartLine);
  } catch {
    return [];
  }
}

export async function persistCartLines(lines: CartLine[]): Promise<boolean> {
  try {
    const payload = JSON.stringify(lines);
    if (payload.length > 2000) {
      /* payload may exceed SecureStore limit */
    }
    await SecureStore.setItemAsync(STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export async function loadShopifyCartId(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(SHOPIFY_CART_ID_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export async function persistShopifyCartId(cartId: string | null): Promise<void> {
  try {
    if (!cartId) {
      await SecureStore.deleteItemAsync(SHOPIFY_CART_ID_KEY);
      return;
    }
    await SecureStore.setItemAsync(SHOPIFY_CART_ID_KEY, cartId);
  } catch {
    /* persist best-effort */
  }
}

export async function loadCartGuestId(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(CART_GUEST_ID_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export async function persistCartGuestId(guestId: string | null): Promise<void> {
  try {
    if (!guestId) {
      await SecureStore.deleteItemAsync(CART_GUEST_ID_KEY);
      return;
    }
    await SecureStore.setItemAsync(CART_GUEST_ID_KEY, guestId);
  } catch {
    /* persist best-effort */
  }
}
