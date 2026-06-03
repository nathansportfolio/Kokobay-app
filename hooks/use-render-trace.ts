import { recordRenderTrace, type RenderTraceLabel } from '@/lib/render-trace';

/** Dev-only — logs `[RENDER] Label` (on by default in dev). */
export function useRenderTrace(label: RenderTraceLabel): void {
  recordRenderTrace(label);
}
