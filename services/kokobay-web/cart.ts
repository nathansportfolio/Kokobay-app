import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';
import { reportOperationalFailure } from '@/lib/appErrorLog';
import { api, isApiError } from '@/src/core/api';
import { logCartTrace } from '@/lib/cart-trace-log';
import { checkoutTraceRequestHeaders, getCheckoutTraceId } from '@/lib/checkout-trace';
import { logCartDeleteTrace } from '@/lib/cart-delete-trace';
import { cartFastPathLog } from '@/lib/cart-fast-path-log';
import { cartFlowLog, cartPerfLog, logCartStateTransition } from '@/lib/cart-perf-log';
import { logShopifyRedirectTraceSource } from '@/lib/shopify-redirect-trace';
import { logAppFirstOrderOnNewCart } from '@/services/cart/app-first-order-new-cart-log';
import { createGuestId } from '@/utils/create-guest-id';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

import type { ShopifyCartSnapshot } from '../shopify/cart';
import { getShopifyCountryCode, getShopifyCurrencyCode } from '../shopify/market-context';
import { resolveKokobayApiBaseUrl } from './api-config';
import { isKokobayWebProductsConfigured } from './client';
import { getCartCustomerEmail } from './cart-customer';

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
    subtotalAmount?: KokobayMoney;
    totalAmount?: KokobayMoney;
  } | null;
};

type KokobayCartDiscountCode = {
  code?: string;
  applicable?: boolean;
  amount?: KokobayMoney;
};

type KokobayCart = {
  id: string | null;
  checkoutUrl: string | null;
  storeCheckoutUrl?: string | null;
  lines: KokobayCartLine[];
  discountCodes?: KokobayCartDiscountCode[];
  cost?: {
    subtotalAmount?: KokobayMoney;
    totalAmount?: KokobayMoney;
    totalTaxAmount?: KokobayMoney;
    discountAmount?: KokobayMoney;
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

function hasPresentMoney(m: KokobayMoney | null | undefined): boolean {
  if (m?.amount == null) return false;
  const trimmed = String(m.amount).trim();
  return trimmed !== '' && Number.isFinite(Number.parseFloat(trimmed));
}

function moneyFromApi(m: KokobayMoney | null | undefined, fallback?: Money): Money | null {
  if (!hasPresentMoney(m)) return null;
  return normalizeMoney(m, fallback);
}

function resolveSnapshotMoney(
  api: KokobayMoney | null | undefined,
  lineFallback: Money | null,
  zeroFallback: Money,
): Money {
  if (hasPresentMoney(api)) return normalizeMoney(api!, zeroFallback);
  if (lineFallback) return lineFallback;
  return zeroFallback;
}

function logCartResponseInDev(
  method: string,
  path: string,
  response: KokobayCartResponse | null,
  status?: number,
): void {
  if (!__DEV__) return;
  console.log('[CART API]', {
    method,
    path,
    status: status ?? null,
    response,
  });
}

function logCartCheckoutUrlRedirectTrace(
  method: string,
  path: string,
  response: KokobayCartResponse | null,
): void {
  if (!response?.cart) return;
  logShopifyRedirectTraceSource('backend_api_response', {
    checkoutUrl: response.cart.checkoutUrl,
    storeCheckoutUrl: response.cart.storeCheckoutUrl,
    cartId: response.cart.id,
    method,
    path,
  });
}

type KokobayCartRequestMeta = {
  parsed: KokobayCartResponse | null;
  httpStatus: number | null;
  requestUrl: string;
  requestBody: Record<string, unknown> | undefined;
};

async function kokobayCartRequestDetailed(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  guestId: string,
  body?: Record<string, unknown>,
  customerEmail?: string,
): Promise<KokobayCartRequestMeta | null> {
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

  const safePath = pathWithMarket.startsWith('/') ? pathWithMarket : `/${pathWithMarket}`;
  const route = safePath.split('?')[0] ?? safePath;
  const requestUrl = `${root.replace(/\/+$/, '')}${safePath}`;
  const reqStart = performance.now();

  logCartTrace('api_request_start', {
    method,
    path: pathWithMarket,
    guestId,
    traceId: getCheckoutTraceId(),
    variantId:
      typeof body?.variantId === 'string'
        ? body.variantId
        : typeof body?.variant_id === 'string'
          ? body.variant_id
          : null,
    lineId:
      typeof body?.lineId === 'string'
        ? body.lineId
        : typeof body?.line_id === 'string'
          ? body.line_id
          : null,
    quantity: typeof body?.quantity === 'number' ? body.quantity : null,
  });

  const requestOpts = {
    auth: 'guest-cart' as const,
    guestIdOverride: guestId,
    marketQuery: false,
    skipAuthRefresh: true,
    coalesce: false,
    retries: 2,
    headers: checkoutTraceRequestHeaders(),
  };

  try {
    const response =
      method === 'GET'
        ? await api.get(safePath, requestOpts)
        : method === 'POST'
          ? await api.post(safePath, payload, requestOpts)
          : method === 'PATCH'
            ? await api.patch(safePath, payload, requestOpts)
            : await api.delete(safePath, {
                ...requestOpts,
                ...(payload !== undefined ? { body: payload } : {}),
              });

    cartFlowLog(method, route, performance.now() - reqStart);
    const parsed = response.data as KokobayCartResponse;

    if (parsed.ok === false) {
      logCartResponseInDev(method, pathWithMarket, parsed, response.status);
      logCartTrace('api_request_complete', {
        method,
        path: pathWithMarket,
        guestId,
        ok: false,
        httpStatus: response.status,
        cartId: parsed.cart?.id ?? null,
        durationMs: Math.round(performance.now() - reqStart),
        code: parsed.code ?? null,
        error: parsed.error ?? null,
      });
      reportOperationalFailure(parsed.error?.trim() || 'Koko Bay cart request failed', {
        source: 'kokobay_cart',
        method,
        path,
        status: response.status,
        code: parsed.code ?? null,
      });
      return {
        parsed,
        httpStatus: response.status,
        requestUrl,
        requestBody: payload,
      };
    }

    logCartResponseInDev(method, pathWithMarket, parsed, response.status);
    logCartCheckoutUrlRedirectTrace(method, pathWithMarket, parsed);
    logCartTrace('api_request_complete', {
      method,
      path: pathWithMarket,
      guestId,
      ok: parsed.ok !== false,
      httpStatus: response.status,
      cartId: parsed.cart?.id ?? null,
      lineCount: parsed.cart?.lines?.length ?? null,
      checkoutUrl: parsed.cart?.checkoutUrl ?? null,
      durationMs: Math.round(performance.now() - reqStart),
      code: parsed.code ?? null,
      error: parsed.error ?? null,
    });
    return {
      parsed,
      httpStatus: response.status,
      requestUrl,
      requestBody: payload,
    };
  } catch (e) {
    cartFlowLog(method, route, performance.now() - reqStart);

    if (isApiError(e) && e.kind === 'http') {
      const errorBody = e.body;
      if (errorBody && typeof errorBody === 'object' && !Array.isArray(errorBody)) {
        const parsed = errorBody as KokobayCartResponse;
        if (parsed.ok === false) {
          logCartResponseInDev(method, pathWithMarket, parsed, e.status);
          reportOperationalFailure(parsed.error?.trim() || 'Koko Bay cart request failed', {
            source: 'kokobay_cart',
            method,
            path,
            status: e.status,
            code: parsed.code ?? null,
          });
          return {
            parsed,
            httpStatus: e.status ?? null,
            requestUrl,
            requestBody: payload,
          };
        }
      }
      if (__DEV__) {
        console.log('[CART API]', {
          method,
          path: pathWithMarket,
          status: e.status ?? null,
          response: errorBody ?? null,
        });
      }
      return {
        parsed: null,
        httpStatus: e.status ?? null,
        requestUrl,
        requestBody: payload,
      };
    }

    if (__DEV__) {
      console.log('[CART API]', {
        method,
        path: pathWithMarket,
        status: isApiError(e) ? (e.status ?? null) : null,
        response: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    logCartTrace('api_request_failed', {
      method,
      path: pathWithMarket,
      guestId,
      ok: false,
      httpStatus: isApiError(e) ? (e.status ?? null) : null,
      durationMs: Math.round(performance.now() - reqStart),
      error: e instanceof Error ? e.message : String(e),
    });

    if (isApiError(e) && e.kind === 'parse') {
      reportOperationalFailure('Koko Bay cart JSON parse failed', {
        source: 'kokobay_cart',
        method,
        path,
        status: e.status,
      });
    } else {
      reportOperationalFailure('Koko Bay cart network error', {
        method,
        path,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    return {
      parsed: null,
      httpStatus: isApiError(e) ? (e.status ?? null) : null,
      requestUrl,
      requestBody: payload,
    };
  }
}

async function kokobayCartRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  guestId: string,
  body?: Record<string, unknown>,
  customerEmail?: string,
): Promise<KokobayCartResponse | null> {
  const result = await kokobayCartRequestDetailed(method, path, guestId, body, customerEmail);
  return result?.parsed ?? null;
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
      listUnitPrice: prev?.listUnitPrice ?? prev?.unitPrice,
    });
  }

  return out;
}

function parseDiscountMoney(m: KokobayMoney | null | undefined): Money | null {
  if (m?.amount == null || String(m.amount).trim() === '') return null;
  const value = Number.parseFloat(String(m.amount));
  if (!Number.isFinite(value)) return null;
  return {
    amount: value.toFixed(2),
    currencyCode: m.currencyCode ?? getShopifyCurrencyCode(),
  };
}

function parseCartDiscountCodes(
  discountCodes: KokobayCartDiscountCode[] | undefined,
  cartDiscountAmount?: Money | null,
): CartDiscountCode[] {
  if (!Array.isArray(discountCodes)) return [];
  return discountCodes
    .map((entry) => {
      const code = entry.code?.trim();
      if (!code) return null;
      const parsed: CartDiscountCode = { code, applicable: entry.applicable !== false };
      const amount = parseDiscountMoney(entry.amount) ?? cartDiscountAmount ?? null;
      if (amount) parsed.amount = amount;
      return parsed;
    })
    .filter((entry): entry is CartDiscountCode => entry !== null);
}

function sumCartLineCost(
  lines: KokobayCartLine[],
  field: 'subtotalAmount' | 'totalAmount',
): Money | null {
  let sum = 0;
  let currencyCode = getShopifyCurrencyCode();
  let found = false;

  for (const line of lines) {
    const amount = line.cost?.[field];
    if (amount?.amount) {
      const value = Number.parseFloat(amount.amount);
      if (Number.isFinite(value)) {
        sum += value;
        currencyCode = amount.currencyCode ?? currencyCode;
        found = true;
        continue;
      }
    }

    const unit = line.cost?.amountPerQuantity;
    if (field === 'totalAmount' && unit?.amount && line.quantity > 0) {
      const value = Number.parseFloat(unit.amount) * line.quantity;
      if (Number.isFinite(value)) {
        sum += value;
        currencyCode = unit.currencyCode ?? currencyCode;
        found = true;
      }
    }
  }

  if (!found) return null;
  return { amount: sum.toFixed(2), currencyCode };
}

function resolveCartCheckoutUrl(
  cart: KokobayCart,
  fallbackCheckoutUrl?: string | null,
): string | null {
  const fromApi =
    cart.checkoutUrl?.trim() || cart.storeCheckoutUrl?.trim() || fallbackCheckoutUrl?.trim() || '';
  return fromApi || null;
}

function snapshotFromCart(
  cart: KokobayCart,
  existing: CartLine[],
  options?: { fallbackCheckoutUrl?: string | null },
): ShopifyCartSnapshot | null {
  const cartId = cart.id?.trim();
  if (!cartId) return null;
  const checkoutUrl = resolveCartCheckoutUrl(cart, options?.fallbackCheckoutUrl);

  const currencyFallback = { amount: '0', currencyCode: getShopifyCurrencyCode() };
  const lineMerchandiseSubtotal = sumCartLineCost(cart.lines, 'subtotalAmount');
  const lineMerchandiseTotal = sumCartLineCost(cart.lines, 'totalAmount');
  const hasLinePricing = Boolean(lineMerchandiseSubtotal || lineMerchandiseTotal);
  const hasApiPricing =
    hasPresentMoney(cart.cost?.subtotalAmount) || hasPresentMoney(cart.cost?.totalAmount);
  const hasLocalLines = existing.some((line) => line.qty > 0);
  const cartHasItems = (cart.lines?.length ?? 0) > 0 || hasLocalLines;

  if (cartHasItems && !hasApiPricing && !hasLinePricing) {
    return null;
  }

  const subtotal = resolveSnapshotMoney(
    cart.cost?.subtotalAmount,
    lineMerchandiseSubtotal,
    currencyFallback,
  );
  const total = resolveSnapshotMoney(
    cart.cost?.totalAmount,
    lineMerchandiseTotal,
    currencyFallback,
  );

  const cartDiscountAmount = parseDiscountMoney(cart.cost?.discountAmount);
  return {
    cartId,
    checkoutUrl,
    lines: parseCartLines(cart, existing),
    subtotal,
    total,
    totalTax: moneyFromApi(cart.cost?.totalTaxAmount),
    discountCodes: parseCartDiscountCodes(cart.discountCodes, cartDiscountAmount),
    cartDiscountAmount,
    lineMerchandiseSubtotal,
    lineMerchandiseTotal,
  };
}

async function getCart(guestId: string, customerEmail?: string): Promise<KokobayCart | null> {
  const start = performance.now();
  const res = await kokobayCartRequest('GET', '/api/cart', guestId, undefined, customerEmail);
  cartPerfLog(`getCart took ${Math.round(performance.now() - start)}ms`);
  return res?.cart ?? null;
}

/** Refetch checkoutUrl when mutation responses omit it. */
export async function fetchRemoteCartCheckoutUrl(
  guestId: string | null,
  customerEmail?: string,
): Promise<string | null> {
  if (!isKokobayWebProductsConfigured()) return null;
  const sessionGuestId = guestId?.trim() || createGuestId();
  const email = customerEmail?.trim() || getCartCustomerEmail();
  const cart = await getCart(sessionGuestId, email);
  return resolveCartCheckoutUrl(cart ?? { id: null, checkoutUrl: null, lines: [] });
}

async function createCart(guestId: string, customerEmail?: string): Promise<KokobayCart | null> {
  const start = performance.now();
  const res = await kokobayCartRequest('POST', '/api/cart', guestId, {}, customerEmail);
  const durationMs = Math.round(performance.now() - start);
  cartPerfLog(`createCart took ${durationMs}ms`);
  const cart = res?.cart ?? null;
  if (cart) {
    void logAppFirstOrderOnNewCart({
      guestId,
      customerEmail,
      cartId: cart.id,
    }).catch(() => {});
  }
  return cart;
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

type RemoveCartLineContext = {
  variantId?: string;
  beforeDeleteRemoteLineCount?: number;
};

async function removeItem(
  guestId: string,
  lineId: string,
  customerEmail?: string,
  context?: RemoveCartLineContext,
): Promise<KokobayCart | null> {
  const start = performance.now();
  const result = await kokobayCartRequestDetailed(
    'DELETE',
    '/api/cart/items',
    guestId,
    { lineId },
    customerEmail,
  );
  const res = result?.parsed ?? null;
  const afterDeleteRemoteLineCount = res?.cart?.lines?.length ?? null;

  logCartDeleteTrace({
    variantBeingRemoved: context?.variantId?.trim() || null,
    shopifyLineId: lineId,
    deleteRequestUrl: result?.requestUrl ?? '/api/cart/items',
    deleteRequestBody: (result?.requestBody as Record<string, unknown> | undefined) ?? { lineId },
    httpStatus: result?.httpStatus ?? null,
    responseBody: res ?? null,
    beforeDeleteRemoteLineCount: context?.beforeDeleteRemoteLineCount ?? null,
    afterDeleteRemoteLineCount,
  });

  cartPerfLog(`removeItem took ${Math.round(performance.now() - start)}ms`);
  return res?.cart ?? null;
}

async function clearCart(guestId: string, customerEmail?: string): Promise<void> {
  const start = performance.now();
  await kokobayCartRequest('DELETE', '/api/cart', guestId, undefined, customerEmail);
  cartPerfLog(`clearCart took ${Math.round(performance.now() - start)}ms`);
}

/** DELETE remote cart only — no GET/reconcile (use on sign-out). */
export async function clearRemoteKokobayCart(
  guestId: string | null,
  customerEmail?: string,
): Promise<void> {
  if (!isKokobayWebProductsConfigured()) return;
  const sessionGuestId = guestId?.trim() || createGuestId();
  await clearCart(sessionGuestId, customerEmail);
}

/** POST /api/cart/discount-code — apply a discount code to the remote cart. */
export async function applyKokobayCartDiscountCode(
  guestId: string | null,
  code: string,
  localLines: CartLine[],
  customerEmail?: string,
): Promise<KokobayCartSyncResult | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const normalizedCode = code.trim();
  if (!normalizedCode) return null;

  const sessionGuestId = guestId?.trim() || createGuestId();
  const email = customerEmail?.trim() || getCartCustomerEmail();
  const start = performance.now();
  const res = await kokobayCartRequest(
    'POST',
    '/api/cart/discount-code',
    sessionGuestId,
    { code: normalizedCode },
    email,
  );
  const durationMs = Math.round(performance.now() - start);
  cartPerfLog(`applyDiscountCode took ${durationMs}ms`);

  if (!res) {
    return {
      snapshot: null,
      guestId: sessionGuestId,
      syncError: { code: 'network_error', message: 'Could not apply discount code' },
    };
  }

  if (res?.ok === false) {
    return {
      snapshot: null,
      guestId: sessionGuestId,
      syncError: cartErrorFromResponse(res),
    };
  }

  const snapshot = res?.cart
    ? snapshotFromCart(res.cart, localLines, {
        fallbackCheckoutUrl: res.cart.checkoutUrl,
      })
    : null;
  return { snapshot, guestId: sessionGuestId, syncError: null };
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
  fallbackCheckoutUrl?: string | null,
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

  const snapshot = result.cart
    ? snapshotFromCart(result.cart, localLines, { fallbackCheckoutUrl })
    : null;
  if (snapshot && !snapshot.checkoutUrl) {
    const refreshed = await fetchRemoteCartCheckoutUrl(sessionGuestId, email);
    if (refreshed) snapshot.checkoutUrl = refreshed;
  }
  return { snapshot, guestId: sessionGuestId, syncError: null };
}

/**
 * POST a single line — no GET /api/cart and no reconcile diff.
 * Use when adding a variant that is not yet on the remote cart (no local `shopifyLineId`).
 */
export async function addCartLineFast(
  guestId: string | null,
  variantId: string,
  quantity: number,
  localLines: CartLine[],
  customerEmail?: string,
  fallbackCheckoutUrl?: string | null,
): Promise<KokobayCartSyncResult | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  cartFastPathLog('add line started');
  cartFastPathLog('reconciliation bypassed');

  const sessionGuestId = guestId?.trim() || createGuestId();
  const email = customerEmail?.trim() || getCartCustomerEmail();
  const addStart = performance.now();
  const result = await addItem(sessionGuestId, variantId.trim(), quantity, email);
  cartFastPathLog(`addItem completed in ${Math.round(performance.now() - addStart)}ms`);

  if (result.error) {
    return {
      snapshot: null,
      guestId: sessionGuestId,
      syncError: result.error,
    };
  }

  const snapshot = result.cart
    ? snapshotFromCart(result.cart, localLines, { fallbackCheckoutUrl })
    : null;
  if (snapshot && !snapshot.checkoutUrl) {
    const refreshed = await fetchRemoteCartCheckoutUrl(sessionGuestId, email);
    if (refreshed) snapshot.checkoutUrl = refreshed;
  }
  return { snapshot, guestId: sessionGuestId, syncError: null };
}

/** Test helper — builds a Shopify snapshot from Koko Bay `/api/cart` JSON. */
export function buildKokobayCartSnapshotForTest(
  cart: KokobayCart,
  existing: CartLine[],
  options?: { fallbackCheckoutUrl?: string | null },
): ShopifyCartSnapshot | null {
  return snapshotFromCart(cart, existing, options);
}

/**
 * Reconcile local bag with Shopify via Koko Bay web `/api/cart` (Mongo maps guest → cart id only).
 */
export async function syncLocalCartToKokobayWeb(
  guestId: string | null,
  localLines: CartLine[],
  customerEmail?: string,
  fallbackCheckoutUrl?: string | null,
): Promise<KokobayCartSyncResult | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const syncStart = performance.now();
  const sessionGuestId = guestId?.trim() || createGuestId();
  const email = customerEmail?.trim() || getCartCustomerEmail();
  cartPerfLog(
    `syncLocalCartToKokobayWeb start lines=${localLines.length} guest=${sessionGuestId.slice(0, 8)}…`,
  );
  logCartStateTransition('syncLocalCartToKokobayWeb:start', localLines.length, -1, {
    guestIdPrefix: sessionGuestId.slice(0, 8),
    customerEmail: email ?? null,
  });

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
  const toRemove: { lineId: string; variantId: string }[] = [];

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
      toRemove.push({ lineId: remoteLine.id, variantId });
    }
  }

  let next = remote;
  let syncError: KokobayCartSyncError | null = null;

  cartPerfLog(
    `sync plan add=${toAdd.length} increment=${toIncrement.length} update=${toUpdate.length} remove=${toRemove.length}`,
  );

  for (const { lineId, variantId } of toRemove) {
    if (syncError) break;
    const beforeDeleteRemoteLineCount = next.lines.length;
    next =
      (await removeItem(sessionGuestId, lineId, email, {
        variantId,
        beforeDeleteRemoteLineCount,
      })) ?? next;
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

  const snapshotOptions = {
    fallbackCheckoutUrl: next.checkoutUrl ?? fallbackCheckoutUrl,
  };
  let snapshot = snapshotFromCart(next, localLines, snapshotOptions);
  if (!snapshot && next) {
    const refreshStart = performance.now();
    const fresh = await getCart(sessionGuestId, email);
    cartPerfLog(
      `sync snapshot refresh getCart took ${Math.round(performance.now() - refreshStart)}ms`,
    );
    if (fresh) {
      snapshot = snapshotFromCart(fresh, localLines, {
        fallbackCheckoutUrl: fresh.checkoutUrl ?? fallbackCheckoutUrl,
      });
    }
  }
  if (snapshot && !snapshot.checkoutUrl) {
    const refreshed = await fetchRemoteCartCheckoutUrl(sessionGuestId, email);
    if (refreshed) snapshot.checkoutUrl = refreshed;
  }

  cartPerfLog(
    `syncLocalCartToKokobayWeb completed in ${Math.round(performance.now() - syncStart)}ms` +
      (syncError ? ` (error: ${syncError.code})` : ''),
  );

  return { snapshot, guestId: sessionGuestId, syncError };
}

/**
 * Dev/admin recovery — GET `/api/cart` only (no reconcile POST/PATCH).
 * Uses an empty local line list so server quantities are not merged with local state.
 */
export async function fetchKokobayCartSnapshotReadOnly(
  guestId: string | null,
  customerEmail?: string,
): Promise<ShopifyCartSnapshot | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const sessionGuestId = guestId?.trim() || createGuestId();
  const email = customerEmail?.trim() || getCartCustomerEmail();
  const cart = await getCart(sessionGuestId, email);
  if (!cart) return null;

  return snapshotFromCart(cart, [], {
    fallbackCheckoutUrl: cart.checkoutUrl ?? cart.storeCheckoutUrl ?? null,
  });
}
