import { legacyApiGetOptional } from '@/src/core/api';

import type { AppVersionConfig } from '@/src/core/app-version/types';
import { isKokobayApiConfigured } from '@/services/kokobay-web/api-config';

function parseSemver(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+){0,2}$/.test(trimmed)) return null;
  return trimmed;
}

function parseAppVersionConfig(json: Record<string, unknown>): AppVersionConfig | null {
  const latestVersion = parseSemver(json.latestVersion);
  const minimumVersion = parseSemver(json.minimumVersion);
  if (!latestVersion || !minimumVersion) return null;

  const title = typeof json.title === 'string' ? json.title.trim() : '';
  const message = typeof json.message === 'string' ? json.message.trim() : '';
  if (!title || !message) return null;

  return {
    latestVersion,
    minimumVersion,
    forceUpdate: json.forceUpdate === true,
    title,
    message,
  };
}

/** `GET /api/app-version` — remote app update policy. */
export async function fetchAppVersionConfig(
  init?: { signal?: AbortSignal },
): Promise<AppVersionConfig | null> {
  if (!isKokobayApiConfigured()) return null;

  const json = await legacyApiGetOptional('/api/app-version', {
    auth: 'none',
    marketQuery: false,
    signal: init?.signal,
    retries: 1,
    coalesce: false,
  });

  if (init?.signal?.aborted || !json) return null;
  return parseAppVersionConfig(json);
}
