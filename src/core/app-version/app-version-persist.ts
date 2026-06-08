import { readFromSecureStore, writeToSecureStore } from '@/services/storage/secureStore';

import {
  APP_VERSION_CONFIG_CACHE_KEY,
  APP_VERSION_CACHE_TTL_MS,
  APP_VERSION_OPTIONAL_DISMISS_KEY,
  APP_VERSION_OPTIONAL_DISMISS_TTL_MS,
} from './constants';
import type { AppVersionConfig } from './types';

type CachedAppVersionConfig = {
  fetchedAtMs: number;
  config: AppVersionConfig;
};

type OptionalDismissRecord = {
  dismissedAtMs: number;
};

export async function readCachedAppVersionConfig(): Promise<AppVersionConfig | null> {
  const raw = await readFromSecureStore(APP_VERSION_CONFIG_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedAppVersionConfig;
    if (!parsed?.config || typeof parsed.fetchedAtMs !== 'number') return null;
    if (Date.now() - parsed.fetchedAtMs > APP_VERSION_CACHE_TTL_MS) return null;
    return parsed.config;
  } catch {
    return null;
  }
}

export async function writeCachedAppVersionConfig(config: AppVersionConfig): Promise<void> {
  const payload: CachedAppVersionConfig = {
    fetchedAtMs: Date.now(),
    config,
  };
  await writeToSecureStore(APP_VERSION_CONFIG_CACHE_KEY, JSON.stringify(payload));
}

export async function isOptionalUpdateDismissed(): Promise<boolean> {
  const raw = await readFromSecureStore(APP_VERSION_OPTIONAL_DISMISS_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as OptionalDismissRecord;
    if (typeof parsed.dismissedAtMs !== 'number') return false;
    return Date.now() - parsed.dismissedAtMs < APP_VERSION_OPTIONAL_DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export async function recordOptionalUpdateDismissed(): Promise<void> {
  const payload: OptionalDismissRecord = { dismissedAtMs: Date.now() };
  await writeToSecureStore(APP_VERSION_OPTIONAL_DISMISS_KEY, JSON.stringify(payload));
}

/** @internal test helper */
export async function clearAppVersionPersistForTests(): Promise<void> {
  await writeToSecureStore(APP_VERSION_CONFIG_CACHE_KEY, '');
  await writeToSecureStore(APP_VERSION_OPTIONAL_DISMISS_KEY, '');
}
