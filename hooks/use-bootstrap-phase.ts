import { useSyncExternalStore } from 'react';

import { bootstrapManager, isBootstrapServicesReady } from '@/src/core/bootstrap';
import type { BootstrapPhase } from '@/src/core/bootstrap';

export function useBootstrapPhase(): {
  phase: BootstrapPhase;
  servicesReady: boolean;
} {
  const phase = useSyncExternalStore(
    (listener) => bootstrapManager.subscribe(listener),
    () => bootstrapManager.getPhase(),
    () => bootstrapManager.getPhase(),
  );

  return {
    phase,
    servicesReady: isBootstrapServicesReady(phase),
  };
}
