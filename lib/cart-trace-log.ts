import { useCartStore } from '@/store/cart';

export type CartTraceDetail = Record<string, unknown>;

function idShort(id: string | null | undefined): string {
  const trimmed = typeof id === 'string' ? id.trim() : '';
  if (!trimmed) return '(none)';
  if (trimmed.length <= 20) return trimmed;
  return `${trimmed.slice(0, 10)}…${trimmed.slice(-6)}`;
}

/** Current in-memory cart ids for trace context. */
export function cartTraceStoreContext(): {
  shopifyCartId: string | null;
  lineCount: number;
  cartRevision?: number;
  checkoutUrl: string | null;
} {
  const state = useCartStore.getState();
  return {
    shopifyCartId: state.shopifyCartId,
    lineCount: state.lines.length,
    checkoutUrl: state.storeCheckoutUrl ?? state.checkoutUrl,
  };
}

/** Step-by-step app cart trace — filter Metro with `[CART_TRACE]`. */
export function logCartTrace(step: string, detail?: CartTraceDetail): void {
  if (!__DEV__) return;

  const payload = detail ?? {};
  const guestId = payload.guestId as string | null | undefined;
  const cartId = (payload.cartId ?? payload.shopifyCartId) as string | null | undefined;
  const variantId = payload.variantId as string | null | undefined;
  const lineId = payload.lineId as string | null | undefined;

  const headline = [
    `[CART_TRACE] step=${step}`,
    guestId !== undefined ? `guest=${idShort(guestId)}` : null,
    cartId !== undefined ? `cart=${idShort(cartId)}` : null,
    variantId !== undefined ? `variant=${idShort(variantId)}` : null,
    lineId !== undefined ? `line=${idShort(lineId)}` : null,
    typeof payload.ok === 'boolean' ? `ok=${payload.ok}` : null,
    typeof payload.action === 'string' ? `action=${payload.action}` : null,
    typeof payload.quantity === 'number' ? `qty=${payload.quantity}` : null,
    typeof payload.lineCount === 'number' ? `lines=${payload.lineCount}` : null,
    typeof payload.source === 'string' ? `source=${payload.source}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  console.log(headline, payload);
}

/** Log with live store cart context merged in. */
export function logCartTraceWithStore(step: string, detail?: CartTraceDetail): void {
  logCartTrace(step, { ...cartTraceStoreContext(), ...detail });
}
