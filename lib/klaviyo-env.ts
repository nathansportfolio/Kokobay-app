/**
 * Klaviyo feature flag and public API key (client-safe `EXPO_PUBLIC_*` only).
 *
 * Set `EXPO_PUBLIC_KLAVIYO_ENABLED=true` in `.env` / EAS env (maps to the
 * `KLAVIYO_ENABLED` flag described in product docs).
 */

function readKlaviyoEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function parseTruthyEnv(value: string | undefined): boolean {
  if (value === undefined) return false;
  if (value === '0' || value === 'false' || value === 'no') return false;
  return value === '1' || value === 'true' || value === 'yes';
}

/** True when `EXPO_PUBLIC_KLAVIYO_ENABLED=true` (or `1` / `yes`). */
export function isKlaviyoEnabledFromEnv(): boolean {
  return parseTruthyEnv(readKlaviyoEnv('EXPO_PUBLIC_KLAVIYO_ENABLED'));
}

/**
 * Klaviyo **public** Site ID / API key for `Klaviyo.initialize()`.
 * Prefer `EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY` (usually 6-char Site ID, e.g. `THMpay`).
 */
export function getKlaviyoPublicApiKeyFromEnv(): string | undefined {
  return (
    readKlaviyoEnv('EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY') ??
    readKlaviyoEnv('EXPO_PUBLIC_KLAVIYO_PUBLIC_API')
  );
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '***';
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

/** Dev-only env summary — never logs the full API key. */
export function getKlaviyoEnvDiagnostics(): {
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  apiKeySource: 'EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY' | 'EXPO_PUBLIC_KLAVIYO_PUBLIC_API' | null;
} {
  const fromKey = readKlaviyoEnv('EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY');
  const fromAlias = readKlaviyoEnv('EXPO_PUBLIC_KLAVIYO_PUBLIC_API');
  const resolved = fromKey ?? fromAlias;
  return {
    enabled: isKlaviyoEnabledFromEnv(),
    hasApiKey: Boolean(resolved),
    apiKeyMasked: resolved ? maskSecret(resolved) : null,
    apiKeySource:
      fromKey ? 'EXPO_PUBLIC_KLAVIYO_PUBLIC_API_KEY'
      : fromAlias ? 'EXPO_PUBLIC_KLAVIYO_PUBLIC_API'
      : null,
  };
}
