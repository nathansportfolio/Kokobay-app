import type { CartLine, CartDiscountCode } from '@/types/cart';
import type { Money } from '@/types/shopify';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

import { fetchShopify, isShopifyConfigured } from './client';
import { getShopifyCountryCode, getShopifyCurrencyCode } from './market-context';
import {
  CART_CREATE,
  CART_LINES_ADD,
  CART_LINES_REMOVE,
  CART_LINES_UPDATE,
  GET_CART,
} from './queries';

export type ShopifyCartSnapshot = {
  cartId: string;
  checkoutUrl: string;
  lines: CartLine[];
  subtotal: Money;
  total: Money;
  totalTax?: Money | null;
  discountCodes?: CartDiscountCode[];
  /** Cart-level discount from API (`cost.discountAmount`). */
  cartDiscountAmount?: Money | null;
  /** Sum of cart line `cost.subtotalAmount` — pre-discount merchandise from the cart API. */
  lineMerchandiseSubtotal?: Money | null;
  /** Sum of cart line `cost.totalAmount` — post-discount merchandise from the cart API. */
  lineMerchandiseTotal?: Money | null;
};

type GqlMoney = { amount: string; currencyCode: string } | null | undefined;

type GqlCartLineNode = {
  id: string;
  quantity: number;
  merchandise?: {
    id?: string;
    title?: string;
    image?: { url?: string | null; altText?: string | null } | null;
    price?: GqlMoney;
    product?: { handle?: string; title?: string } | null;
  } | null;
};

type GqlCart = {
  id: string;
  checkoutUrl?: string | null;
  cost?: {
    subtotalAmount?: GqlMoney;
    totalAmount?: GqlMoney;
    totalTaxAmount?: GqlMoney;
  } | null;
  lines?: { edges?: { node: GqlCartLineNode }[] | null } | null;
};

type UserError = { field?: string[] | null; message: string };

function normalizeMoney(
  m: GqlMoney,
  fallback: Money = { amount: '0', currencyCode: getShopifyCurrencyCode() },
): Money {
  return {
    amount: m?.amount ?? fallback.amount,
    currencyCode: m?.currencyCode ?? fallback.currencyCode,
  };
}

function toCartLineInput(line: CartLine): { merchandiseId: string; quantity: number } {
  return { merchandiseId: line.variantId, quantity: line.qty };
}

function parseCartLines(cart: GqlCart, existing: CartLine[]): CartLine[] {
  const byVariant = new Map(existing.map((l) => [l.variantId, l]));
  const edges = cart.lines?.edges ?? [];
  const out: CartLine[] = [];

  for (const { node } of edges) {
    const merch = node.merchandise;
    const variantId = merch?.id?.trim();
    if (!variantId) continue;
    const prev = byVariant.get(variantId);
    const handle = merch?.product?.handle?.trim() || prev?.handle || '';
    if (!handle) continue;
    out.push({
      handle,
      variantId,
      qty: node.quantity,
      shopifyLineId: node.id,
      title: merch?.product?.title?.trim() || prev?.title,
      variantTitle: merch?.title?.trim() || prev?.variantTitle,
      imageUrl: merch?.image?.url?.trim() || prev?.imageUrl || null,
      unitPrice: merch?.price ? normalizeMoney(merch.price, prev?.unitPrice) : prev?.unitPrice,
      listUnitPrice: prev?.listUnitPrice ?? prev?.unitPrice,
    });
  }

  return out;
}

function snapshotFromCart(cart: GqlCart, existing: CartLine[]): ShopifyCartSnapshot | null {
  const checkoutUrl = cart.checkoutUrl?.trim();
  if (!cart.id || !checkoutUrl) return null;
  return {
    cartId: cart.id,
    checkoutUrl,
    lines: parseCartLines(cart, existing),
    subtotal: normalizeMoney(cart.cost?.subtotalAmount),
    total: normalizeMoney(cart.cost?.totalAmount),
    totalTax: cart.cost?.totalTaxAmount
      ? normalizeMoney(cart.cost.totalTaxAmount)
      : null,
  };
}

function logUserErrors(_context: string, _errors: UserError[] | null | undefined): void {}

async function fetchCart(cartId: string): Promise<GqlCart | null> {
  const data = await fetchShopify<{ cart: GqlCart | null }>(GET_CART, { cartId });
  return data?.cart ?? null;
}

async function createCart(lines: CartLine[]): Promise<GqlCart | null> {
  const data = await fetchShopify<{
    cartCreate: { cart: GqlCart | null; userErrors: UserError[] };
  }>(CART_CREATE, {
    input: {
      lines: lines.map(toCartLineInput),
      buyerIdentity: { countryCode: getShopifyCountryCode() },
    },
  });
  logUserErrors('cartCreate', data?.cartCreate.userErrors);
  return data?.cartCreate.cart ?? null;
}

async function addLines(cartId: string, lines: CartLine[]): Promise<GqlCart | null> {
  if (!lines.length) return fetchCart(cartId);
  const data = await fetchShopify<{
    cartLinesAdd: { cart: GqlCart | null; userErrors: UserError[] };
  }>(CART_LINES_ADD, {
    cartId,
    lines: lines.map(toCartLineInput),
  });
  logUserErrors('cartLinesAdd', data?.cartLinesAdd.userErrors);
  return data?.cartLinesAdd.cart ?? null;
}

async function updateLines(
  cartId: string,
  updates: { id: string; quantity: number }[],
): Promise<GqlCart | null> {
  if (!updates.length) return fetchCart(cartId);
  const data = await fetchShopify<{
    cartLinesUpdate: { cart: GqlCart | null; userErrors: UserError[] };
  }>(CART_LINES_UPDATE, { cartId, lines: updates });
  logUserErrors('cartLinesUpdate', data?.cartLinesUpdate.userErrors);
  return data?.cartLinesUpdate.cart ?? null;
}

async function removeLines(cartId: string, lineIds: string[]): Promise<GqlCart | null> {
  if (!lineIds.length) return fetchCart(cartId);
  const data = await fetchShopify<{
    cartLinesRemove: { cart: GqlCart | null; userErrors: UserError[] };
  }>(CART_LINES_REMOVE, { cartId, lineIds });
  logUserErrors('cartLinesRemove', data?.cartLinesRemove.userErrors);
  return data?.cartLinesRemove.cart ?? null;
}

/**
 * Reconcile local bag lines with Shopify Storefront cart (create, add, update, remove).
 * Returns null when Shopify is not configured or sync fails.
 */
export async function syncLocalCartToShopify(
  cartId: string | null,
  localLines: CartLine[],
): Promise<ShopifyCartSnapshot | null> {
  if (!isShopifyConfigured()) return null;
  if (!localLines.length) return null;

  let remote = cartId ? await fetchCart(cartId) : null;
  if (!remote) {
    remote = await createCart(localLines);
    return remote ? snapshotFromCart(remote, localLines) : null;
  }

  const remoteLines = remote.lines?.edges?.map((e) => e.node) ?? [];
  const remoteByVariant = new Map<string, GqlCartLineNode>();
  for (const line of remoteLines) {
    const variantId = line.merchandise?.id;
    if (variantId) remoteByVariant.set(shopifyVariantKey(variantId), line);
  }

  const localByVariant = new Map(localLines.map((l) => [shopifyVariantKey(l.variantId), l]));
  const toAdd: CartLine[] = [];
  const toUpdate: { id: string; quantity: number }[] = [];
  const toRemove: string[] = [];

  for (const local of localLines) {
    const remoteLine = remoteByVariant.get(shopifyVariantKey(local.variantId));
    if (!remoteLine) {
      toAdd.push(local);
      continue;
    }
    if (remoteLine.quantity !== local.qty) {
      toUpdate.push({ id: remoteLine.id, quantity: local.qty });
    }
  }

  for (const remoteLine of remoteLines) {
    const variantId = remoteLine.merchandise?.id;
    if (variantId && !localByVariant.has(shopifyVariantKey(variantId))) {
      toRemove.push(remoteLine.id);
    }
  }

  let next = remote;
  if (toRemove.length) next = (await removeLines(remote.id, toRemove)) ?? next;
  if (toAdd.length) next = (await addLines(remote.id, toAdd)) ?? next;
  if (toUpdate.length) next = (await updateLines(remote.id, toUpdate)) ?? next;

  return snapshotFromCart(next, localLines);
}

export async function fetchShopifyCheckoutUrl(cartId: string): Promise<string | null> {
  const cart = await fetchCart(cartId);
  return cart?.checkoutUrl?.trim() || null;
}
