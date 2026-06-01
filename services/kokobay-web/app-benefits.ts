import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

import { resolveKokobayApiBaseUrl } from './api-config';
import { isKokobayWebProductsConfigured } from './client';
import { buildKokobayCustomerAuthHeaders } from './customer-session';

export type AppBenefitsEligibleDiscount = Record<string, unknown>;

export type CustomerAppBenefits = {
  isFirstAppOrder: boolean;
  appOrdersCount: number;
  eligibleDiscounts: AppBenefitsEligibleDiscount[];
};

export type FetchAppBenefitsResult =
  | { ok: true; benefits: CustomerAppBenefits }
  | { ok: false };

const CACHE_TTL_MS = 60_000;

let cache: {
  sessionKey: string;
  benefits: CustomerAppBenefits;
  fetchedAt: number;
} | null = null;

let inFlight: Promise<FetchAppBenefitsResult> | null = null;
let inFlightSessionKey: string | null = null;

function sessionCacheKey(sessionToken?: string | null): string {
  return sessionToken?.trim() || '';
}

function readCachedBenefits(sessionToken?: string | null): CustomerAppBenefits | null {
  const key = sessionCacheKey(sessionToken);
  if (!key || !cache) return null;
  if (cache.sessionKey !== key) return null;
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
  return cache.benefits;
}

function writeCachedBenefits(sessionToken: string, benefits: CustomerAppBenefits): void {
  cache = {
    sessionKey: sessionToken,
    benefits,
    fetchedAt: Date.now(),
  };
}

export function invalidateAppBenefitsCache(): void {
  cache = null;
}

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

async function requestAppBenefits(sessionToken: string): Promise<FetchAppBenefitsResult> {
  if (!isKokobayWebProductsConfigured()) {
    return { ok: false };
  }

  const root = resolveKokobayApiBaseUrl();
  if (!root) {
    return { ok: false };
  }

  const headers = await buildKokobayCustomerAuthHeaders(sessionToken, {
    includeGuestCart: false,
  });
  if (!headers.Authorization) {
    return { ok: false };
  }

  try {
    const res = await fetchWithTimeout(`${root}/api/customer/app-benefits`, {
      method: 'GET',
      headers,
    });

    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false };
    }

    if (!res.ok) {
      return { ok: false };
    }

    const benefits = parseAppBenefitsPayload(data);
    if (!benefits) {
      return { ok: false };
    }

    writeCachedBenefits(sessionToken, benefits);
    return { ok: true, benefits };
  } catch {
    return { ok: false };
  }
}

/** GET /api/customer/app-benefits — app order history + eligible discounts (Bearer session). */
export async function fetchCustomerAppBenefits(
  sessionToken?: string | null,
  options?: { force?: boolean },
): Promise<FetchAppBenefitsResult> {
  const key = sessionCacheKey(sessionToken);
  if (!key) {
    return { ok: false };
  }

  if (!options?.force) {
    const cached = readCachedBenefits(sessionToken);
    if (cached) {
      return { ok: true, benefits: cached };
    }
  }

  if (inFlight && inFlightSessionKey === key) {
    return inFlight;
  }

  inFlightSessionKey = key;
  inFlight = requestAppBenefits(key).finally(() => {
    inFlight = null;
    inFlightSessionKey = null;
  });

  return inFlight;
}
