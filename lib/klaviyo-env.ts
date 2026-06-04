import { KLAVIYO_ENABLED_DEFAULT, KLAVIYO_PUBLIC_SITE_ID } from '@/constants/klaviyo';

/**
 * Klaviyo feature flag and public Site ID.
 *
 * Production values are hardcoded in `@/constants/klaviyo`. Env vars can override the Site ID
 * or disable Klaviyo (`EXPO_PUBLIC_KLAVIYO_ENABLED=false`).
 */

function readKlaviyoEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function parseKlaviyoEnabledEnv(value: string | undefined): boolean {
  if (value === undefined) return KLAVIYO_ENABLED_DEFAULT;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

/** True unless `EXPO_PUBLIC_KLAVIYO_ENABLED` is explicitly `false` / `0` / `no` / `off`. */
export function isKlaviyoEnabledFromEnv(): boolean {
  return parseKlaviyoEnabledEnv(readKlaviyoEnv('EXPO_PUBLIC_KLAVIYO_ENABLED'));
}

/**
 * Klaviyo **public** Site ID for `Klaviyo.initialize()`.
 * Uses `EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY` when set, otherwise {@link KLAVIYO_PUBLIC_SITE_ID}.
 */
export function getKlaviyoPublicApiKeyFromEnv(): string {
  return readKlaviyoEnv('EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY') ?? KLAVIYO_PUBLIC_SITE_ID;
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '***';
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export type KlaviyoApiKeySource =
  | 'EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY'
  | 'hardcoded'
  | null;

/** Dev-only env summary — never logs the full API key. */
export function getKlaviyoEnvDiagnostics(): {
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  apiKeySource: KlaviyoApiKeySource;
} {
  const fromEnv = readKlaviyoEnv('EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY');
  const resolved = getKlaviyoPublicApiKeyFromEnv();
  return {
    enabled: isKlaviyoEnabledFromEnv(),
    hasApiKey: Boolean(resolved),
    apiKeyMasked: resolved ? maskSecret(resolved) : null,
    apiKeySource: fromEnv ? 'EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY' : 'hardcoded',
  };
}
