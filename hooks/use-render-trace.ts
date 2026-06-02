import { recordRenderTrace, type RenderTraceLabel } from '@/lib/render-trace';

/** Dev-only — logs `[RENDER] Label` when `EXPO_PUBLIC_RENDER_TRACE=1`. */
export function useRenderTrace(label: RenderTraceLabel): void {
  recordRenderTrace(label);
}
