import { useAppVersionStore } from '@/store/app-version';

/** Reactive app version check state for update drawers. */
export function useAppVersionCheck() {
  const status = useAppVersionStore((s) => s.status);
  const prompt = useAppVersionStore((s) => s.prompt);
  const title = useAppVersionStore((s) => s.title);
  const message = useAppVersionStore((s) => s.message);
  const currentVersion = useAppVersionStore((s) => s.currentVersion);
  const config = useAppVersionStore((s) => s.config);
  const optionalDismissed = useAppVersionStore((s) => s.optionalDismissed);
  const setPrompt = useAppVersionStore((s) => s.setPrompt);

  return {
    status,
    prompt,
    title,
    message,
    currentVersion,
    config,
    optionalDismissed,
    isRequired: prompt === 'required',
    isOptional: prompt === 'optional',
    dismissOptional: () => setPrompt('none'),
  };
}
