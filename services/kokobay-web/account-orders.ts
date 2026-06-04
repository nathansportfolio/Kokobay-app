import type {
  AccountOrder,
  AccountOrderAddress,
  AccountOrderLineItem,
  AccountOrderPayment,
  AccountOrderRefund,
  AccountOrderTracking,
  AccountOrdersPagination,
  AccountOrdersResult,
} from '@/types/account-order';
import type { Money } from '@/types/shopify';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

import { resolveKokobayApiBaseUrl } from './api-config';
import { kokobayCustomerMe } from './customer-auth';
import { isKokobayWebProductsConfigured } from './client';
import {
  buildKokobayCustomerAuthHeaders,
  resolveActiveCustomerSessionToken,
} from './customer-session';
import { logAccountOrders, summarizeOrder, summarizeOrders } from '@/utils/account-order-debug';

type FetchOptions = {
  first?: number;
  after?: string;
  sessionToken?: string;
};

function baseUrl(): string | undefined {
  return resolveKokobayApiBaseUrl();
}

function normalizeMoney(raw: unknown): Money {
  if (typeof raw !== 'object' || raw === null) {
    return { amount: '0', currencyCode: 'GBP' };
  }
  const o = raw as Record<string, unknown>;
  const amount = typeof o.amount === 'string' ? o.amount : '0';
  const currencyCode =
    (typeof o.currencyCode === 'string' && o.currencyCode) ||
    (typeof o.currency === 'string' && o.currency) ||
    'GBP';
  return { amount, currencyCode };
}

function normalizeLineItem(raw: unknown): AccountOrderLineItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const title =
    (typeof o.title === 'string' && o.title) ||
    (typeof o.productTitle === 'string' && o.productTitle) ||
    undefined;
  const quantity = typeof o.quantity === 'number' ? o.quantity : undefined;
  const variantTitle = typeof o.variantTitle === 'string' ? o.variantTitle : null;
  const imageUrl =
    typeof o.imageUrl === 'string'
      ? o.imageUrl
      : typeof (o.image as { url?: string } | undefined)?.url === 'string'
        ? (o.image as { url: string }).url
        : null;
  const unitPriceRaw = o.unitPrice ?? o.originalUnitPrice ?? o.price;
  const unitPrice =
    typeof unitPriceRaw === 'object' && unitPriceRaw !== null
      ? normalizeMoney(unitPriceRaw)
      : undefined;
  if (!title && !quantity) return null;
  return { title, quantity, variantTitle, imageUrl, unitPrice };
}

function normalizeTracking(raw: unknown): AccountOrderTracking | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  return {
    url: typeof o.url === 'string' ? o.url : null,
    number: typeof o.number === 'string' ? o.number : null,
    company: typeof o.company === 'string' ? o.company : null,
  };
}

function normalizeRefund(raw: unknown): AccountOrderRefund | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : String(o.id ?? '');
  if (!id) return null;
  const totalRefundedRaw = o.totalRefunded ?? o.amount;
  return {
    id,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : undefined,
    totalRefunded: normalizeMoney(totalRefundedRaw),
  };
}

function normalizeAddress(raw: unknown): AccountOrderAddress | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const name =
    (typeof o.name === 'string' && o.name) ||
    [o.firstName, o.lastName]
      .filter((part) => typeof part === 'string' && part.trim())
      .join(' ')
      .trim() ||
    undefined;

  const address: AccountOrderAddress = {
    name,
    address1: typeof o.address1 === 'string' ? o.address1 : undefined,
    address2: typeof o.address2 === 'string' ? o.address2 : undefined,
    city: typeof o.city === 'string' ? o.city : undefined,
    province:
      (typeof o.province === 'string' && o.province) ||
      (typeof o.provinceCode === 'string' && o.provinceCode) ||
      undefined,
    zip:
      (typeof o.zip === 'string' && o.zip) ||
      (typeof o.postalCode === 'string' && o.postalCode) ||
      undefined,
    country:
      (typeof o.country === 'string' && o.country) ||
      (typeof o.countryCode === 'string' && o.countryCode) ||
      undefined,
    phone: typeof o.phone === 'string' ? o.phone : undefined,
  };

  if (
    !address.name &&
    !address.address1 &&
    !address.city &&
    !address.zip &&
    !address.country &&
    !address.phone
  ) {
    return null;
  }

  return address;
}

function normalizePayment(raw: unknown): AccountOrderPayment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const methodLabel =
    (typeof o.methodLabel === 'string' && o.methodLabel) ||
    (typeof o.method === 'string' && o.method) ||
    (typeof o.cardBrand === 'string' && typeof o.cardLast4 === 'string'
      ? `${o.cardBrand} •••• ${o.cardLast4}`
      : undefined);

  const amountRaw = o.amount ?? o.totalPrice;
  const amount =
    typeof amountRaw === 'object' && amountRaw !== null ? normalizeMoney(amountRaw) : undefined;

  const processedAt =
    (typeof o.processedAt === 'string' && o.processedAt) ||
    (typeof o.createdAt === 'string' && o.createdAt) ||
    undefined;

  if (!methodLabel && !amount && !processedAt) return null;

  return { methodLabel, amount, processedAt };
}

function normalizeOrder(raw: unknown): AccountOrder | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : String(o.id ?? '');
  const orderNumber = typeof o.orderNumber === 'string' ? o.orderNumber : '';
  const createdAt = typeof o.createdAt === 'string' ? o.createdAt : '';
  if (!id || !orderNumber) {
    logAccountOrders('normalizeOrder skipped', {
      rawId: o.id,
      rawOrderNumber: o.orderNumber,
      rawName: o.name,
    });
    return null;
  }

  logAccountOrders('normalizeOrder raw', {
    rawId: o.id,
    rawOrderNumber: o.orderNumber,
    rawName: o.name,
    normalizedId: id,
    normalizedOrderNumber: orderNumber,
  });

  const lineItems = Array.isArray(o.lineItems)
    ? o.lineItems.map(normalizeLineItem).filter((x): x is AccountOrderLineItem => x !== null)
    : [];

  const tracking = Array.isArray(o.tracking)
    ? o.tracking.map(normalizeTracking).filter((x): x is AccountOrderTracking => x !== null)
    : [];

  const actionsRaw = o.actions;
  const actions =
    typeof actionsRaw === 'object' && actionsRaw !== null
      ? (actionsRaw as AccountOrder['actions'])
      : undefined;

  const refunds = Array.isArray(o.refunds)
    ? o.refunds.map(normalizeRefund).filter((x): x is AccountOrderRefund => x !== null)
    : [];

  const shippingAddress = normalizeAddress(o.shippingAddress);
  const billingAddress = normalizeAddress(o.billingAddress);
  const payment = normalizePayment(o.payment);

  const order = {
    id,
    orderNumber,
    createdAt,
    financialStatus: typeof o.financialStatus === 'string' ? o.financialStatus : null,
    fulfillmentStatus: typeof o.fulfillmentStatus === 'string' ? o.fulfillmentStatus : null,
    totalPrice: normalizeMoney(o.totalPrice),
    lineItems,
    tracking,
    statusPageUrl: typeof o.statusPageUrl === 'string' ? o.statusPageUrl : null,
    refunds,
    email: typeof o.email === 'string' ? o.email : null,
    shippingAddress,
    billingAddress,
    shippingMethod: typeof o.shippingMethod === 'string' ? o.shippingMethod : null,
    payment,
    actions,
  };

  logAccountOrders('normalizeOrder result', summarizeOrder(order));
  return order;
}

function normalizePagination(raw: unknown, first: number): AccountOrdersPagination {
  if (typeof raw !== 'object' || raw === null) {
    return { first, hasNextPage: false, endCursor: null };
  }
  const o = raw as Record<string, unknown>;
  return {
    first: typeof o.first === 'number' ? o.first : first,
    hasNextPage: o.hasNextPage === true,
    endCursor: typeof o.endCursor === 'string' ? o.endCursor : null,
  };
}

async function fetchAccountOrdersOnce(
  options: FetchOptions,
): Promise<AccountOrdersResult> {
  const root = baseUrl();
  if (!root) {
    return { ok: false, error: 'Orders are not configured.' };
  }

  const sessionToken = await resolveActiveCustomerSessionToken(options.sessionToken);
  if (!sessionToken) {
    return {
      ok: false,
      error: 'Sign in to view your orders',
      code: 'unauthorized',
      unauthorized: true,
    };
  }

  const first = Math.min(Math.max(options.first ?? 20, 1), 50);
  const params = new URLSearchParams({ first: String(first) });
  if (options.after?.trim()) {
    params.set('after', options.after.trim());
  }

  const url = `${root}/api/account/orders?${params.toString()}`;
  const headers = await buildKokobayCustomerAuthHeaders(sessionToken, {
    includeGuestCart: false,
  });

  logAccountOrders('fetch request', { url, after: options.after ?? null, first });

  try {
    const res = await fetchWithTimeout(url, { headers });
    const text = await res.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'Could not read order history.' };
    }

    logAccountOrders('fetch response meta', {
      status: res.status,
      ok: parsed.ok,
      rawOrderCount: Array.isArray(parsed.orders) ? parsed.orders.length : 0,
      pagination: parsed.pagination,
    });

    if (Array.isArray(parsed.orders)) {
      logAccountOrders(
        'fetch response raw orders',
        parsed.orders.map((raw) => {
          const row = raw as Record<string, unknown>;
          return {
            id: row.id,
            orderNumber: row.orderNumber,
            name: row.name,
            createdAt: row.createdAt,
          };
        }),
      );
    }

    if (res.status === 401 || parsed.code === 'unauthorized') {
      return {
        ok: false,
        error: typeof parsed.error === 'string' ? parsed.error : 'Sign in to view your orders',
        code: 'unauthorized',
        unauthorized: true,
      };
    }

    if (!res.ok || parsed.ok === false) {
      return {
        ok: false,
        error:
          typeof parsed.error === 'string' ? parsed.error : 'Could not load order history.',
        code: typeof parsed.code === 'string' ? parsed.code : undefined,
      };
    }

    const orders = Array.isArray(parsed.orders)
      ? parsed.orders.map(normalizeOrder).filter((o): o is AccountOrder => o !== null)
      : [];

    logAccountOrders('fetch normalized orders', summarizeOrders(orders));

    return {
      ok: true,
      orders,
      pagination: normalizePagination(parsed.pagination, first),
    };
  } catch {
    return { ok: false, error: 'Could not load order history. Check your connection.' };
  }
}

/**
 * Customer order history — `GET /api/account/orders` with Bearer + session cookie.
 */
export async function fetchAccountOrders(options: FetchOptions = {}): Promise<AccountOrdersResult> {
  if (!isKokobayWebProductsConfigured()) {
    return { ok: false, error: 'Orders are not configured.' };
  }

  let result = await fetchAccountOrdersOnce(options);
  if (!result.ok && result.unauthorized) {
    const refreshed = await kokobayCustomerMe();
    if (refreshed.status === 'ok') {
      result = await fetchAccountOrdersOnce({
        ...options,
        sessionToken: refreshed.session.accessToken,
      });
    }
  }

  return result;
}
