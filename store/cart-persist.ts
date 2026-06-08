import * as SecureStore from 'expo-secure-store';

import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';
import { resolveCartLineUnitPrice } from '@/utils/cart-line-pricing';

const STORAGE_KEY = 'kokobay_cart_v1';
const SHOPIFY_CART_ID_KEY = 'kokobay_shopify_cart_id_v1';
const CART_GUEST_ID_KEY = 'kokobay_cart_guest_id_v1';

/** Persisted cart row — identity plus display snapshot for cold-start rendering. */
export type PersistedCartLine = {
  handle: string;
  variantId: string;
  qty: number;
  shopifyLineId?: string;
  title?: string;
  variantTitle?: string;
  imageUrl?: string | null;
  unitPrice?: Money;
  listUnitPrice?: Money;
  maxQty?: number;
};

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

function optionalMoneyField(k: string, o: Record<string, unknown>): boolean {
  if (!(k in o) || o[k] === undefined || o[k] === null) return true;
  return isMoneySnapshot(o[k]);
}

function optionalMaxQty(o: Record<string, unknown>): boolean {
  if (!('maxQty' in o) || o.maxQty === undefined || o.maxQty === null) return true;
  return typeof o.maxQty === 'number' && Number.isFinite(o.maxQty) && o.maxQty >= 1 && o.maxQty <= 99;
}

function isPersistedCartLine(x: unknown): x is PersistedCartLine {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.handle !== 'string' || o.handle.length === 0) return false;
  if (typeof o.variantId !== 'string' || o.variantId.length === 0) return false;
  if (typeof o.qty !== 'number' || !Number.isFinite(o.qty) || o.qty < 1 || o.qty > 99) {
    return false;
  }
  return (
    optionalNullableString('shopifyLineId', o) &&
    optionalNullableString('title', o) &&
    optionalNullableString('variantTitle', o) &&
    optionalNullableString('imageUrl', o) &&
    optionalMoneyField('unitPrice', o) &&
    optionalMoneyField('listUnitPrice', o) &&
    optionalMaxQty(o)
  );
}

/** True when a hydrated line cannot render cart UI without a remote refresh. */
export function cartLineMissingPersistedDisplay(line: CartLine): boolean {
  if (resolveCartLineUnitPrice(line) === null) return true;
  if (!line.title?.trim()) return true;
  if (!line.imageUrl?.trim()) return true;
  return false;
}

export function toPersistedCartLine(line: CartLine): PersistedCartLine {
  const persisted: PersistedCartLine = {
    handle: line.handle,
    variantId: line.variantId,
    qty: line.qty,
  };
  const shopifyLineId = line.shopifyLineId?.trim();
  if (shopifyLineId) persisted.shopifyLineId = shopifyLineId;
  const title = line.title?.trim();
  if (title) persisted.title = title;
  const variantTitle = line.variantTitle?.trim();
  if (variantTitle) persisted.variantTitle = variantTitle;
  if (line.imageUrl !== undefined) persisted.imageUrl = line.imageUrl;
  if (line.unitPrice) persisted.unitPrice = line.unitPrice;
  if (line.listUnitPrice) persisted.listUnitPrice = line.listUnitPrice;
  if (line.maxQty != null) persisted.maxQty = line.maxQty;
  return persisted;
}

export function persistedCartLineToCartLine(line: PersistedCartLine): CartLine {
  return {
    handle: line.handle,
    variantId: line.variantId,
    qty: line.qty,
    ...(line.shopifyLineId ? { shopifyLineId: line.shopifyLineId } : {}),
    ...(line.title ? { title: line.title } : {}),
    ...(line.variantTitle ? { variantTitle: line.variantTitle } : {}),
    ...(line.imageUrl !== undefined ? { imageUrl: line.imageUrl } : {}),
    ...(line.unitPrice ? { unitPrice: line.unitPrice } : {}),
    ...(line.listUnitPrice ? { listUnitPrice: line.listUnitPrice } : {}),
    ...(line.maxQty != null ? { maxQty: line.maxQty } : {}),
  };
}

export async function loadPersistedCart(): Promise<CartLine[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isPersistedCartLine)
      .map(persistedCartLineToCartLine);
  } catch {
    return [];
  }
}

export async function persistCartLines(lines: CartLine[]): Promise<boolean> {
  try {
    const payload = JSON.stringify(lines.map(toPersistedCartLine));
    if (__DEV__) {
      console.log('[PERSIST]', `bytes=${payload.length}`);
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

/** Dev/admin recovery — wipe all cart keys from SecureStore. */
export async function clearCartSecureStore(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(SHOPIFY_CART_ID_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(CART_GUEST_ID_KEY).catch(() => {}),
  ]);
}
