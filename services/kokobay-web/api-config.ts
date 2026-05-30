/** Default production Koko Bay web API when env is unset. */
export const DEFAULT_KOKOBAY_PRODUCTION_API_URL = 'https://kokobay-mizd.vercel.app';

/** Default local Next.js API (simulator). Use your LAN IP on a physical device. */
export const DEFAULT_KOKOBAY_LOCAL_API_URL = 'http://localhost:3000';

function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function parseEnvBoolean(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  if (!v) return false;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

/** `true` when `EXPO_PUBLIC_KOKOBAY_USE_LOCALHOST=true` — app uses the local API URL. */
export function kokobayUseLocalhost(): boolean {
  return parseEnvBoolean(process.env.EXPO_PUBLIC_KOKOBAY_USE_LOCALHOST);
}

function productionApiUrlFromEnv(): string | undefined {
  const u =
    process.env.EXPO_PUBLIC_KOKOBAY_API_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_KOKOBAY_API_URL?.trim();
  return u ? normalizeApiUrl(u) : undefined;
}

function localApiUrlFromEnv(): string | undefined {
  const u = process.env.EXPO_PUBLIC_KOKOBAY_API_LOCAL_URL?.trim();
  return u ? normalizeApiUrl(u) : undefined;
}

type ResolveKokobayApiBaseUrlOptions = {
  /** When true, falls back to built-in production URL if env is unset. */
  fallbackToDefault?: boolean;
};

/** Active Koko Bay API origin (no trailing slash). */
export function resolveKokobayApiBaseUrl(
  options?: ResolveKokobayApiBaseUrlOptions,
): string | undefined {
  const fallback = options?.fallbackToDefault ?? false;
  if (kokobayUseLocalhost()) {
    return localApiUrlFromEnv() ?? DEFAULT_KOKOBAY_LOCAL_API_URL;
  }
  return (
    productionApiUrlFromEnv() ?? (fallback ? DEFAULT_KOKOBAY_PRODUCTION_API_URL : undefined)
  );
}

export function isKokobayApiConfigured(): boolean {
  return Boolean(resolveKokobayApiBaseUrl());
}

/** Which env vars are active (never logs secrets). */
export function kokobayApiEnvDebug(): {
  useLocalhost: boolean;
  baseUrl: string | undefined;
  productionUrl: string | undefined;
  localUrl: string | undefined;
  hasOptionalProductsApiKey: boolean;
} {
  return {
    useLocalhost: kokobayUseLocalhost(),
    baseUrl: resolveKokobayApiBaseUrl(),
    productionUrl: productionApiUrlFromEnv(),
    localUrl: localApiUrlFromEnv() ?? DEFAULT_KOKOBAY_LOCAL_API_URL,
    hasOptionalProductsApiKey: Boolean(process.env.EXPO_PUBLIC_KOKOBAY_PRODUCTS_API_KEY?.trim()),
  };
}
