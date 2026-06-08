import type { ProductVariant } from '@/types/shopify';

import { api, isApiError, legacyApiErrorBody } from '@/src/core/api';
import { hasLocalBackInStockSubscription, markBackInStockSubscribed } from '@/store/back-in-stock-persist';
import { shopifyVariantKey } from '@/utils/shopify-variant-key';

import { resolveKokobayApiBaseUrl } from './api-config';
import { isKokobayWebProductsConfigured } from './client';

export type BackInStockSubscribeInput = {
  email: string;
  productHandle: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
};

export type BackInStockSubscribeResult =
  | { ok: true; alreadySubscribed?: boolean }
  | { ok: false; error: string };

function apiRoot(): string | undefined {
  return resolveKokobayApiBaseUrl();
}

function optionDisplayRank(name: string): number {
  const l = name.toLowerCase();
  if (l === 'size') return 0;
  if (l === 'color' || l === 'colour') return 1;
  return 2;
}

/** Human-readable variant line for back-in-stock API payloads. */
export function variantTitleForBackInStock(variant: ProductVariant): string {
  const title = variant.title?.trim();
  if (title && title !== 'Default Title') return title;
  const values = variant.selectedOptions
    .filter((o) => o.value?.trim())
    .sort((a, b) => optionDisplayRank(a.name) - optionDisplayRank(b.name))
    .map((o) => o.value.trim());
  return values.length ? values.join(' / ') : 'One size';
}

function parseSubscribedFlag(data: Record<string, unknown> | null): boolean {
  if (!data || data.ok !== true) return false;
  if (data.subscribed === true || data.active === true || data.isSubscribed === true) {
    return true;
  }
  const subscriptions = data.subscriptions;
  if (Array.isArray(subscriptions) && subscriptions.length > 0) return true;
  return false;
}

function parseErrorMessage(data: Record<string, unknown> | null, fallback: string): string {
  const error = data?.error;
  return typeof error === 'string' && error.trim() ? error.trim() : fallback;
}

function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length >= 5 && trimmed.includes('@') && trimmed.includes('.');
}

export async function checkBackInStockSubscription(input: {
  variantId: string;
  email?: string;
  customerId?: string;
  sessionToken?: string;
}): Promise<boolean> {
  const variantKey = shopifyVariantKey(input.variantId);
  const email = input.email?.trim();
  const customerId = input.customerId?.trim();

  if (email || customerId) {
    const local = await hasLocalBackInStockSubscription({
      variantId: input.variantId,
      email,
      customerId,
    });
    if (local) return true;
  }

  if (!input.sessionToken?.trim() || !isKokobayWebProductsConfigured()) {
    return false;
  }

  if (!apiRoot()) return false;

  const params = new URLSearchParams({ variantId: variantKey });
  if (email) params.set('email', email.trim());

  const response = await api.get(`/api/back-in-stock?${params.toString()}`, {
    auth: 'active-customer',
    sessionOverride: input.sessionToken,
    includeGuestCart: false,
    marketQuery: false,
    optional: true,
    retries: 0,
    coalesce: false,
  });

  if (!response) return false;

  const data = response.data as Record<string, unknown>;
  const subscribed = parseSubscribedFlag(data);
  if (subscribed && email) {
    await markBackInStockSubscribed({
      variantId: input.variantId,
      email,
      customerId,
    });
  }
  return subscribed;
}

export async function subscribeBackInStock(
  input: BackInStockSubscribeInput,
  options?: { sessionToken?: string; customerId?: string },
): Promise<BackInStockSubscribeResult> {
  const email = input.email.trim();
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!isKokobayWebProductsConfigured()) {
    return { ok: false, error: 'Back-in-stock alerts are not configured.' };
  }

  if (!apiRoot()) {
    return { ok: false, error: 'Back-in-stock alerts are not configured.' };
  }

  const payload = {
    email,
    productHandle: input.productHandle.trim(),
    variantId: shopifyVariantKey(input.variantId),
    productTitle: input.productTitle.trim(),
    variantTitle: input.variantTitle.trim(),
  };

  try {
    const response = await api.post('/api/back-in-stock', payload, {
      auth: options?.sessionToken?.trim() ? 'active-customer' : 'none',
      sessionOverride: options?.sessionToken,
      includeGuestCart: false,
      marketQuery: false,
      retries: 0,
      coalesce: false,
    });

    const data = response.data as Record<string, unknown>;
    if (data?.ok !== true) {
      return {
        ok: false,
        error: parseErrorMessage(data, 'Could not save your alert. Please try again.'),
      };
    }

    const alreadySubscribed =
      data.alreadySubscribed === true ||
      data.duplicate === true ||
      data.code === 'duplicate';

    await markBackInStockSubscribed({
      variantId: input.variantId,
      email,
      customerId: options?.customerId,
    });

    return { ok: true, ...(alreadySubscribed ? { alreadySubscribed: true } : {}) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'http') {
      const data = legacyApiErrorBody(error);
      return {
        ok: false,
        error: parseErrorMessage(data, 'Could not save your alert. Please try again.'),
      };
    }
    return { ok: false, error: 'Could not save your alert. Please try again.' };
  }
}
