/** Cold-start bootstrap phases — user can shop after Phase A. */
export type BootstrapPhase = 'idle' | 'A' | 'B' | 'C' | 'complete';

const PHASE_ORDER: BootstrapPhase[] = ['idle', 'A', 'B', 'C', 'complete'];

export function isBootstrapPhaseAtLeast(
  current: BootstrapPhase,
  minimum: BootstrapPhase,
): boolean {
  return PHASE_ORDER.indexOf(current) >= PHASE_ORDER.indexOf(minimum);
}

/** Phase C finished — safe to init analytics, Klaviyo SDK, and push registration. */
export function isBootstrapServicesReady(phase: BootstrapPhase): boolean {
  return phase === 'complete';
}

/** Phase A finished — auth restored; main navigator can render. */
export function isBootstrapUiReady(phase: BootstrapPhase): boolean {
  return isBootstrapPhaseAtLeast(phase, 'B');
}
