import { api } from '@/src/core/api';

import { isKokobayWebProductsConfigured } from './client';

export type AppBenefitsEligibleDiscount = Record<string, unknown>;

export type CustomerAppBenefits = {
  isFirstAppOrder: boolean;
  appOrdersCount: number;
  eligibleDiscounts: AppBenefitsEligibleDiscount[];
};

export type FetchAppBenefitsResult =
  | { ok: true; benefits: CustomerAppBenefits }
  | { ok: false };

function parseAppBenefitsPayload(data: Record<string, unknown> | null): CustomerAppBenefits | null {
  if (data?.ok !== true) return null;
  if (typeof data.isFirstAppOrder !== 'boolean') return null;
  if (typeof data.appOrdersCount !== 'number' || !Number.isFinite(data.appOrdersCount)) return null;
  if (!Array.isArray(data.eligibleDiscounts)) return null;
  return {
    isFirstAppOrder: data.isFirstAppOrder,
    appOrdersCount: data.appOrdersCount,
    eligibleDiscounts: data.eligibleDiscounts.filter(
      (item): item is AppBenefitsEligibleDiscount =>
        item !== null && typeof item === 'object' && !Array.isArray(item),
    ),
  };
}

/** GET /api/customer/app-benefits — app order history + eligible discounts (Bearer session). */
export async function fetchCustomerAppBenefits(
  sessionToken?: string | null,
  options?: { force?: boolean },
): Promise<FetchAppBenefitsResult> {
  const key = sessionToken?.trim();
  if (!key) {
    return { ok: false };
  }

  if (!isKokobayWebProductsConfigured()) {
    return { ok: false };
  }

  const response = await api.get('/api/customer/app-benefits', {
    auth: 'active-customer',
    sessionOverride: key,
    includeGuestCart: false,
    marketQuery: false,
    optional: true,
    retries: 0,
    coalesce: false,
    ...(options?.force ? { headers: { 'Cache-Control': 'no-store' } } : {}),
  });

  if (!response) {
    return { ok: false };
  }

  const benefits = parseAppBenefitsPayload(response.data as Record<string, unknown>);
  if (!benefits) {
    return { ok: false };
  }

  return { ok: true, benefits };
}
