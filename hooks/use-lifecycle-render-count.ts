import { isLifecyclePerfEnabled, recordRender, type LifecycleScreenId } from '@/lib/lifecycle-perf';

/** Dev-only screen render counter for lifecycle dashboard (`[lifecycle]`). */
export function useLifecycleRenderCount(screen: LifecycleScreenId): void {
  if (!isLifecyclePerfEnabled()) return;
  recordRender(screen);
}
