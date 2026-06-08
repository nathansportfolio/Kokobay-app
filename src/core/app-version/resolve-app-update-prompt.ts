import type { AppVersionCheckResult, AppVersionConfig, AppUpdatePromptKind } from './types';
import { isVersionLessThan } from './version-utils';

export function resolveAppUpdatePrompt(
  currentVersion: string,
  config: AppVersionConfig | null,
  optionalDismissed: boolean,
): AppUpdatePromptKind {
  if (!config) return 'none';

  if (config.forceUpdate || isVersionLessThan(currentVersion, config.minimumVersion)) {
    return 'required';
  }

  if (
    isVersionLessThan(currentVersion, config.latestVersion) &&
    !optionalDismissed
  ) {
    return 'optional';
  }

  return 'none';
}

export function buildAppVersionCheckResult(
  currentVersion: string,
  config: AppVersionConfig | null,
  optionalDismissed: boolean,
): AppVersionCheckResult {
  const prompt = resolveAppUpdatePrompt(currentVersion, config, optionalDismissed);

  return {
    currentVersion,
    config,
    prompt,
    optionalDismissed:
      Boolean(config && isVersionLessThan(currentVersion, config.latestVersion)) &&
      optionalDismissed,
  };
}
