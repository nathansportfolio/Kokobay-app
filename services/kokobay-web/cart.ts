import type { CartLine } from '@/types/cart';
import type { Money } from '@/types/shopify';
import { reportOperationalFailure } from '@/lib/appErrorLog';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';
import { cartFastPathLog } from '@/lib/cart-fast-path-log';
import { cartFlowLog, cartPerfLog } from '@/lib/cart-perf-log';
import { createGuestId } from '@/utils/create-guest-id';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

import type { ShopifyCartSnapshot } from '../shopify/cart';
import { getShopifyCountryCode, getShopifyCurrencyCode } from '../shopify/market-context';
import { resolveKokobayApiBaseUrl } from './api-config';
import { isKokobayWebProductsConfigured } from './client';
import { getCartCustomerEmail } from './cart-customer';
import { buildKokobayCustomerAuthHeaders } from './customer-session';

export { KOKOBAY_CART_GUEST_COOKIE } from '@/constants/kokobay-cookies';

type KokobayMoney = { amount: string; currencyCode: string } | null | undefined;

type KokobayCartLine = {
  id: string;
  quantity: number;
  merchandiseId?: string;
  variantId?: string;
  title?: string;
  product?: { handle?: string; title?: string } | null;
  image?: { url?: string | null; altText?: string | null } | null;
  cost?: {
    amountPerQuantity?: KokobayMoney;
    totalAmount?: KokobayMoney;
  } | null;
};

type KokobayCart = {
  id: string | null;
  checkoutUrl: string | null;
  lines: KokobayCartLine[];
  cost?: {
    subtotalAmount?: KokobayMoney;
    totalAmount?: KokobayMoney;
    totalTaxAmount?: KokobayMoney;
  } | null;
};

type KokobayCartResponse = {
  ok?: boolean;
  cart?: KokobayCart;
  error?: string;
  code?: string;
};

export type KokobayCartSyncError = {
  code: string;
  message: string;
};

type KokobayCartMutationResult = {
  cart: KokobayCart | null;
  error: KokobayCartSyncError | null;
};

function cartErrorFromResponse(res: KokobayCartResponse | null): KokobayCartSyncError | null {
  if (!res || res.ok !== false) return null;
  const message = res.error?.trim() || 'Could not update your bag';
  const code = res.code?.trim() || 'cart_error';
  return { code, message };
}

function baseUrl(): string | undefined {
  return resolveKokobayApiBaseUrl();
}

function normalizeMoney(
  m: KokobayMoney,
  fallback: Money = { amount: '0', currencyCode: getShopifyCurrencyCode() },
): Money {
  return {
    amount: m?.amount ?? fallback.amount,
    currencyCode: m?.currencyCode ?? fallback.currencyCode,
  };
}

/** Dev-only: inspect cart API payload for cost / delivery fields. */
function logCartResponseInDev(_method: string, _cart: KokobayCart | undefined): void {}

async function kokobayCartRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  guestId: string,
  body?: Record<string, unknown>,
  customerEmail?: string,
): Promise<KokobayCartResponse | null> {
  const root = baseUrl();
  if (!root) return null;

  const country = getShopifyCountryCode();
  const currency = getShopifyCurrencyCode();
  const marketParams = new URLSearchParams();
  if (country) {
    marketParams.set('country', country);
    marketParams.set('countryCode', country);
  }
  if (currency) {
    marketParams.set('currency', currency);
    marketParams.set('currencyCode', currency);
  }
  const marketQuery = marketParams.toString();
  const pathWithMarket =
    marketQuery && !path.includes('country=') && !path.includes('currency=')
      ? `${path}${path.includes('?') ? '&' : '?'}${marketQuery}`
      : path;
  const url = `${root}${pathWithMarket.startsWith('/') ? pathWithMarket : `/${pathWithMarket}`}`;
  const headers = await buildKokobayCustomerAuthHeaders(undefined, { guestIdOverride: guestId });

  const email = customerEmail?.trim() || getCartCustomerEmail();
  let payload = body;
  if (email && body !== undefined) {
    payload = { ...body, email };
  } else if (email && method === 'POST' && path === '/api/cart') {
    payload = { email };
  }
  if (payload !== undefined) {
    payload = {
      ...payload,
      ...(country ? { countryCode: country } : {}),
      ...(currency ? { currencyCode: currency } : {}),
    };
  }

  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const route = pathWithMarket.split('?')[0] ?? pathWithMarket;
  const reqStart = performance.now();
  try {
    const res = await fetchWithTimeout(url, {
      method,
      headers,
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
    cartFlowLog(method, route, performance.now() - reqStart);
    const text = await res.text();
    let parsed: KokobayCartResponse;
    try {
      parsed = JSON.parse(text) as KokobayCartResponse;
    } catch {
      reportOperationalFailure('Koko Bay cart JSON parse failed', {
        source: 'kokobay_cart',
        method,
        path,
        status: res.status,
        bodyPreview: text.slice(0, 300),
      });
      return null;
    }

    if (!res.ok || parsed.ok === false) {
      reportOperationalFailure(parsed.error?.trim() || 'Koko Bay cart request failed', {
        source: 'kokobay_cart',
        method,
        path,
        status: res.status,
        code: parsed.code ?? null,
      });
      return parsed.ok === false ? parsed : null;
    }

    logCartResponseInDev(method, parsed.cart);

    return parsed;
  } catch (e) {
    cartFlowLog(method, route, performance.now() - reqStart);
    reportOperationalFailure('Koko Bay cart network error', {
      method,
      path,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

function parseCartLines(cart: KokobayCart, existing: CartLine[]): CartLine[] {
  const byVariant = new Map(existing.map((l) => [l.variantId, l]));
  const out: CartLine[] = [];

  for (const line of cart.lines) {
    const variantId = (line.variantId ?? line.merchandiseId)?.trim();
    if (!variantId) continue;
    const prev = byVariant.get(variantId);
    const handle = line.product?.handle?.trim() || prev?.handle || '';
    if (!handle) continue;
    out.push({
      handle,
      variantId,
      qty: line.quantity,
      shopifyLineId: line.id,
      title: line.product?.title?.trim() || prev?.title,
      variantTitle: line.title?.trim() || prev?.variantTitle,
      imageUrl: line.image?.url?.trim() || prev?.imageUrl || null,
      unitPrice: line.cost?.amountPerQuantity
        ? normalizeMoney(line.cost.amountPerQuantity, prev?.unitPrice)
        : prev?.unitPrice,
    });
  }

  return out;
}

function snapshotFromCart(cart: KokobayCart, existing: CartLine[]): ShopifyCartSnapshot | null {
  const checkoutUrl = cart.checkoutUrl?.trim();
  const cartId = cart.id?.trim();
  if (!cartId || !checkoutUrl) return null;
  return {
    cartId,
    checkoutUrl,
    lines: parseCartLines(cart, existing),
    subtotal: normalizeMoney(cart.cost?.subtotalAmount),
    total: normalizeMoney(cart.cost?.totalAmount),
    totalTax: cart.cost?.totalTaxAmount
      ? normalizeMoney(cart.cost.totalTaxAmount)
      : null,
  };
}

async function getCart(guestId: string, customerEmail?: string): Promise<KokobayCart | null> {
  const start = performance.now();
  const res = await kokobayCartRequest('GET', '/api/cart', guestId, undefined, customerEmail);
  cartPerfLog(`getCart took ${Math.round(performance.now() - start)}ms`);
  return res?.cart ?? null;
}

async function createCart(guestId: string, customerEmail?: string): Promise<KokobayCart | null> {
  const start = performance.now();
  const res = await kokobayCartRequest('POST', '/api/cart', guestId, {}, customerEmail);
  cartPerfLog(`createCart took ${Math.round(performance.now() - start)}ms`);
  return res?.cart ?? null;
}

async function addItem(
  guestId: string,
  variantId: string,
  quantity: number,
  customerEmail?: string,
): Promise<KokobayCartMutationResult> {
  const start = performance.now();
  const res = await kokobayCartRequest(
    'POST',
    '/api/cart/items',
    guestId,
    { variantId, quantity },
    customerEmail,
  );
  cartPerfLog(`addItem took ${Math.round(performance.now() - start)}ms`);
  if (res?.cart) return { cart: res.cart, error: null };
  return { cart: null, error: cartErrorFromResponse(res) };
}

async function updateItem(
  guestId: string,
  lineId: string,
  quantity: number,
  customerEmail?: string,
  variantId?: string,
): Promise<KokobayCartMutationResult> {
  const start = performance.now();
  const body: Record<string, unknown> = { lineId, quantity };
  const normalizedVariantId = variantId?.trim();
  if (normalizedVariantId) body.variantId = normalizedVariantId;
  const res = await kokobayCartRequest(
    'PATCH',
    '/api/cart/items',
    guestId,
    body,
    customerEmail,
  );
  cartPerfLog(`updateItem took ${Math.round(performance.now() - start)}ms`);
  if (res?.cart) return { cart: res.cart, error: null };
  return { cart: null, error: cartErrorFromResponse(res) };
}

async function removeItem(guestId: string, lineId: string, customerEmail?: string): Promise<KokobayCart | null> {
  const start = performance.now();
  const res = await kokobayCartRequest('DELETE', '/api/cart/items', guestId, { lineId }, customerEmail);
  cartPerfLog(`removeItem took ${Math.round(performance.now() - start)}ms`);
  return res?.cart ?? null;
}

async function clearCart(guestId: string, customerEmail?: string): Promise<void> {
  const start = performance.now();
  await kokobayCartRequest('DELETE', '/api/cart', guestId, undefined, customerEmail);
  cartPerfLog(`clearCart took ${Math.round(performance.now() - start)}ms`);
}

export type KokobayCartSyncResult = {
  snapshot: ShopifyCartSnapshot | null;
  guestId: string;
  syncError?: KokobayCartSyncError | null;
};

/**
 * PATCH a single line quantity — no GET, no reconcile diff.
 * Use when local state already has `shopifyLineId`.
 */
export async function updateCartQuantityFast(
  guestId: string | null,
  lineId: string,
  quantity: number,
  localLines: CartLine[],
  customerEmail?: string,
): Promise<KokobayCartSyncResult | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  cartFastPathLog('quantity update started');
  cartFastPathLog('reconciliation bypassed');

  const sessionGuestId = guestId?.trim() || createGuestId();
  const email = customerEmail?.trim() || getCartCustomerEmail();
  const variantId = localLines.find((line) => line.shopifyLineId === lineId.trim())?.variantId;
  const patchStart = performance.now();
  const result = await updateItem(sessionGuestId, lineId.trim(), quantity, email, variantId);
  cartFastPathLog(`PATCH completed in ${Math.round(performance.now() - patchStart)}ms`);

  if (result.error) {
    return {
      snapshot: null,
      guestId: sessionGuestId,
      syncError: result.error,
    };
  }

  const snapshot = result.cart ? snapshotFromCart(result.cart, localLines) : null;
  return { snapshot, guestId: sessionGuestId, syncError: null };
}

/**
 * Reconcile local bag with Shopify via Koko Bay web `/api/cart` (Mongo maps guest → cart id only).
 */
export async function syncLocalCartToKokobayWeb(
  guestId: string | null,
  localLines: CartLine[],
  customerEmail?: string,
): Promise<KokobayCartSyncResult | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const syncStart = performance.now();
  const sessionGuestId = guestId?.trim() || createGuestId();
  const email = customerEmail?.trim() || getCartCustomerEmail();
  cartPerfLog(
    `syncLocalCartToKokobayWeb start lines=${localLines.length} guest=${sessionGuestId.slice(0, 8)}…`,
  );

  if (!localLines.length) {
    await clearCart(sessionGuestId, email);
    cartPerfLog(
      `syncLocalCartToKokobayWeb completed in ${Math.round(performance.now() - syncStart)}ms (cleared)`,
    );
    return { snapshot: null, guestId: sessionGuestId };
  }

  const loadRemoteStart = performance.now();
  let remote = (await getCart(sessionGuestId, email)) ?? (await createCart(sessionGuestId, email));
  cartPerfLog(`sync reconcile load remote took ${Math.round(performance.now() - loadRemoteStart)}ms`);
  if (!remote) {
    cartPerfLog(
      `syncLocalCartToKokobayWeb completed in ${Math.round(performance.now() - syncStart)}ms (no remote)`,
    );
    return { snapshot: null, guestId: sessionGuestId };
  }

  const remoteByVariant = new Map<string, KokobayCartLine>();
  for (const line of remote.lines) {
    const variantId = (line.variantId ?? line.merchandiseId)?.trim();
    if (variantId) remoteByVariant.set(shopifyVariantKey(variantId), line);
  }

  const localByVariant = new Map(localLines.map((l) => [shopifyVariantKey(l.variantId), l]));
  const toAdd: CartLine[] = [];
  const toIncrement: { variantId: string; quantity: number }[] = [];
  const toUpdate: { lineId: string; quantity: number; variantId: string }[] = [];
  const toRemove: string[] = [];

  for (const local of localLines) {
    const remoteLine = remoteByVariant.get(shopifyVariantKey(local.variantId));
    if (!remoteLine) {
      toAdd.push(local);
      continue;
    }
    if (remoteLine.quantity !== local.qty) {
      if (local.qty > remoteLine.quantity) {
        toIncrement.push({
          variantId: local.variantId,
          quantity: local.qty - remoteLine.quantity,
        });
      } else {
        toUpdate.push({
          lineId: remoteLine.id,
          quantity: local.qty,
          variantId: local.variantId,
        });
      }
    }
  }

  for (const remoteLine of remote.lines) {
    const variantId = (remoteLine.variantId ?? remoteLine.merchandiseId)?.trim();
    if (variantId && !localByVariant.has(shopifyVariantKey(variantId))) {
      toRemove.push(remoteLine.id);
    }
  }

  let next = remote;
  let syncError: KokobayCartSyncError | null = null;

  cartPerfLog(
    `sync plan add=${toAdd.length} increment=${toIncrement.length} update=${toUpdate.length} remove=${toRemove.length}`,
  );

  for (const lineId of toRemove) {
    if (syncError) break;
    next = (await removeItem(sessionGuestId, lineId, email)) ?? next;
  }
  for (const local of toAdd) {
    if (syncError) break;
    const result = await addItem(sessionGuestId, local.variantId, local.qty, email);
    if (result.error) {
      syncError = result.error;
      break;
    }
    if (result.cart) next = result.cart;
  }
  for (const inc of toIncrement) {
    if (syncError) break;
    const result = await addItem(sessionGuestId, inc.variantId, inc.quantity, email);
    if (result.error) {
      syncError = result.error;
      break;
    }
    if (result.cart) next = result.cart;
  }
  for (const { lineId, quantity, variantId } of toUpdate) {
    if (syncError) break;
    const result = await updateItem(sessionGuestId, lineId, quantity, email, variantId);
    if (result.error) {
      syncError = result.error;
      break;
    }
    if (result.cart) next = result.cart;
  }

  if (syncError) {
    const refreshStart = performance.now();
    const fresh = await getCart(sessionGuestId, email);
    cartPerfLog(`sync error refresh getCart took ${Math.round(performance.now() - refreshStart)}ms`);
    if (fresh) next = fresh;
  }

  const snapshot = snapshotFromCart(next, localLines);

  cartPerfLog(
    `syncLocalCartToKokobayWeb completed in ${Math.round(performance.now() - syncStart)}ms` +
      (syncError ? ` (error: ${syncError.code})` : ''),
  );

  return { snapshot, guestId: sessionGuestId, syncError };
}
