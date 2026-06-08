/** Keep in sync with `SHOP_COLLECTION_VIEWPORT_PREFETCH_COUNT`. */
const VIEWPORT_ROW_COUNT = 6;

type TraceState = {
  startedAt: number;
  expectedViewportImages: number;
  loadedViewportRows: Set<number>;
  firstImageLogged: boolean;
  viewportCompleteLogged: boolean;
};

let trace: TraceState | null = null;

export function resetShopTabPerfTrace(meta?: Record<string, unknown>): void {
  trace = {
    startedAt: performance.now(),
    expectedViewportImages: 0,
    loadedViewportRows: new Set(),
    firstImageLogged: false,
    viewportCompleteLogged: false,
  };
  if (__DEV__) {
    console.log('[SHOP_TAB_PERF] trace_reset', meta ?? {});
  }
}

/** Call when prefetch starts so viewport-complete waits for the right row count. */
export function markShopTabViewportExpected(imageCount: number): void {
  if (!trace) return;
  trace.expectedViewportImages = imageCount;
  if (__DEV__) {
    console.log('[SHOP_TAB_PERF] viewport_expected', { imageCount });
  }
}

export function logShopTabFirstRowRender(meta?: Record<string, unknown>): void {
  if (!__DEV__ || !trace) return;
  const ms = Math.round(performance.now() - trace.startedAt);
  console.log(`[SHOP_TAB_PERF] first_row_render_ms=${ms}`, meta ?? {});
}

export function logShopTabFirstImageLoad(meta?: Record<string, unknown>): void {
  if (!__DEV__ || !trace || trace.firstImageLogged) return;
  trace.firstImageLogged = true;
  const ms = Math.round(performance.now() - trace.startedAt);
  console.log(`[SHOP_TAB_PERF] first_image_visible_ms=${ms}`, meta ?? {});
}

export function logShopTabViewportImageLoad(
  rowIndex: number,
  meta?: Record<string, unknown>,
): void {
  if (!__DEV__ || !trace) return;
  if (rowIndex < 0 || rowIndex >= VIEWPORT_ROW_COUNT) return;
  trace.loadedViewportRows.add(rowIndex);
  maybeLogShopTabViewportComplete(meta);
}

function maybeLogShopTabViewportComplete(meta?: Record<string, unknown>): void {
  if (!trace || trace.viewportCompleteLogged) return;
  const expected = trace.expectedViewportImages;
  if (expected <= 0 || trace.loadedViewportRows.size < expected) return;
  trace.viewportCompleteLogged = true;
  const ms = Math.round(performance.now() - trace.startedAt);
  console.log(`[SHOP_TAB_PERF] viewport_complete_ms=${ms}`, {
    ...(meta ?? {}),
    loadedRows: trace.loadedViewportRows.size,
    expectedRows: expected,
  });
}

/** Test helper */
export function resetShopTabPerfTraceForTests(): void {
  trace = null;
}
