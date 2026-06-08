export type CartDeleteTracePayload = {
  variantBeingRemoved: string | null;
  shopifyLineId: string;
  deleteRequestUrl: string;
  deleteRequestBody: Record<string, unknown>;
  httpStatus: number | null;
  responseBody: unknown;
  afterDeleteRemoteLineCount: number | null;
  beforeDeleteRemoteLineCount: number | null;
};

/** Structured trace for Shopify cart line DELETE reconciliation. */
export function logCartDeleteTrace(payload: CartDeleteTracePayload): void {
  if (!__DEV__) return;
  console.log('[CART_DELETE_TRACE]', JSON.stringify(payload, null, 2));
}
