import { fetchAppVersionConfig } from '@/services/kokobay-web/app-version';
import { useAppVersionStore } from '@/store/app-version';

import {
  isOptionalUpdateDismissed,
  readCachedAppVersionConfig,
  writeCachedAppVersionConfig,
} from './app-version-persist';
import { buildAppVersionCheckResult } from './resolve-app-update-prompt';
import type { AppVersionCheckResult, AppVersionConfig } from './types';
import { getCurrentAppVersion } from './get-current-app-version';

let inMemoryConfig: AppVersionConfig | null = null;

function publishCheckResult(result: AppVersionCheckResult): AppVersionCheckResult {
  useAppVersionStore.getState().applyCheckResult(result);
  return result;
}

/**
 * Startup version check — fail open on API errors.
 * Applies cached policy immediately, then refreshes from the network.
 */
export async function checkAppVersion(): Promise<AppVersionCheckResult> {
  const currentVersion = getCurrentAppVersion();
  const optionalDismissed = await isOptionalUpdateDismissed();

  const cached = inMemoryConfig ?? (await readCachedAppVersionConfig());
  if (cached) {
    inMemoryConfig = cached;
    publishCheckResult(buildAppVersionCheckResult(currentVersion, cached, optionalDismissed));
  }

  const fresh = await fetchAppVersionConfig().catch(() => null);
  if (fresh) {
    inMemoryConfig = fresh;
    await writeCachedAppVersionConfig(fresh);
    const dismissed = await isOptionalUpdateDismissed();
    return publishCheckResult(
      buildAppVersionCheckResult(currentVersion, fresh, dismissed),
    );
  }

  if (cached) {
    return buildAppVersionCheckResult(currentVersion, cached, optionalDismissed);
  }

  return publishCheckResult(
    buildAppVersionCheckResult(currentVersion, null, optionalDismissed),
  );
}

/** @internal test helper */
export function resetAppVersionMemoryForTests(): void {
  inMemoryConfig = null;
}
