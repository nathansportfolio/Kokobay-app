/** Remote version policy from `GET /api/app-version`. */
export type AppVersionConfig = {
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  title: string;
  message: string;
};

export type AppUpdatePromptKind = 'none' | 'optional' | 'required';

export type AppVersionCheckResult = {
  currentVersion: string;
  config: AppVersionConfig | null;
  prompt: AppUpdatePromptKind;
  /** True when optional prompt was suppressed by a recent dismissal. */
  optionalDismissed: boolean;
};

export type AppVersionCheckState = AppVersionCheckResult & {
  status: 'idle' | 'checking' | 'ready';
};
