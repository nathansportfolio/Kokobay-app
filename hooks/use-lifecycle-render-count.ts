import { recordRender, type LifecycleScreenId } from '@/lib/lifecycle-perf';

/** Dev-only — increments render count for lifecycle perf dashboard. */
export function useLifecycleRenderCount(screen: LifecycleScreenId): void {
  if (!__DEV__) return;
  recordRender(screen);
}
