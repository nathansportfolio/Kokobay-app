import { getShopifyCountryCode } from './market-context';

const DEFAULT_API_VERSION = '2025-01';

/**
 * `EXPO_PUBLIC_SHOPIFY_DOMAIN` or `EXPO_PUBLIC_SHOPIFY_STORE` (same as `SHOPIFY_STORE` in your web repo),
 * e.g. `koko-bay.myshopify.com` — no `https://`, no path.
 */
export function resolveShopifyStoreDomain(): string | undefined {
  const raw =
    process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN?.trim() ||
    process.env.EXPO_PUBLIC_SHOPIFY_STORE?.trim();
  if (!raw) {
    return undefined;
  }
  return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function storefrontEndpoint(): string | null {
  const domain = resolveShopifyStoreDomain();
  const version =
    process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_API_VERSION?.trim() || DEFAULT_API_VERSION;
  if (!domain) {
    return null;
  }
  return `https://${domain}/api/${version}/graphql.json`;
}

export function isShopifyConfigured(): boolean {
  const domain = resolveShopifyStoreDomain();
  const token = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim();
  return Boolean(domain && token);
}

/** Client secret / Admin token will never work as Storefront access token. */
export function storefrontAccessTokenLooksInvalid(): boolean {
  const token = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim();
  if (!token) return false;
  return token.startsWith('shpss_') || token.startsWith('shpat_');
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

/**
 * Low-level Storefront GraphQL POST. Returns `null` on network errors, HTTP errors,
 * GraphQL errors, or missing configuration — never throws.
 */
export async function fetchShopify<T>(
  query: string,
  variables?: Record<string, unknown>,
  init?: { signal?: AbortSignal },
): Promise<T | null> {
  const url = storefrontEndpoint();
  const token = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  try {
    const country = getShopifyCountryCode();
    const mergedVariables =
      query.includes('@inContext') && country
        ? { ...variables, country }
        : variables;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables: mergedVariables }),
      signal: init?.signal,
    });

    const json = (await response.json()) as GraphQLResponse<T>;

    if (!response.ok) {
      return null;
    }

    if (json.errors?.length) {
      return null;
    }

    if (json.data === undefined || json.data === null) {
      return null;
    }

    return json.data;
  } catch {
    return null;
  }
}
