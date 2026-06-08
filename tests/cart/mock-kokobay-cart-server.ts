import { ApiError } from '@/src/core/api/errorHandler';

export const TEST_VARIANT_A = 'gid://shopify/ProductVariant/1001';
export const TEST_VARIANT_B = 'gid://shopify/ProductVariant/1002';
export const TEST_HANDLE_A = 'linen-midi-dress';
export const TEST_HANDLE_B = 'silk-scarf';

type MockLine = {
  id: string;
  variantId: string;
  quantity: number;
  merchandiseId: string;
  title: string;
  product: { handle: string; title: string };
  cost: {
    amountPerQuantity: { amount: string; currencyCode: string };
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
};

type MockCart = {
  id: string;
  guestId: string;
  checkoutUrl: string;
  lines: MockLine[];
  discountCodes: Array<{
    code: string;
    applicable: boolean;
    amount?: { amount: string; currencyCode: string };
  }>;
};

type RouteOpts = {
  guestIdOverride?: string;
  auth?: string;
  sessionOverride?: string;
};

function lineSubtotal(line: MockLine): number {
  return Number.parseFloat(line.cost.subtotalAmount.amount);
}

function cartSubtotal(cart: MockCart): string {
  const sum = cart.lines.reduce((acc, line) => acc + lineSubtotal(line), 0);
  return sum.toFixed(2);
}

function buildLine(
  cart: MockCart,
  variantId: string,
  handle: string,
  title: string,
  quantity: number,
): MockLine {
  const unit = '89.00';
  const subtotal = (Number.parseFloat(unit) * quantity).toFixed(2);
  return {
    id: `line-${cart.lines.length + 1}`,
    variantId,
    merchandiseId: variantId,
    quantity,
    title,
    product: { handle, title },
    cost: {
      amountPerQuantity: { amount: unit, currencyCode: 'GBP' },
      subtotalAmount: { amount: subtotal, currencyCode: 'GBP' },
      totalAmount: { amount: subtotal, currencyCode: 'GBP' },
    },
  };
}

function cartPayload(cart: MockCart): Record<string, unknown> {
  const subtotal = cartSubtotal(cart);
  const discountAmount =
    cart.discountCodes.length > 0
      ? { amount: '8.90', currencyCode: 'GBP' }
      : { amount: '0.00', currencyCode: 'GBP' };
  return {
    ok: true,
    cart: {
      id: cart.id,
      checkoutUrl: cart.checkoutUrl,
      storeCheckoutUrl: cart.checkoutUrl,
      lines: cart.lines,
      discountCodes: cart.discountCodes,
      cost: {
        subtotalAmount: { amount: subtotal, currencyCode: 'GBP' },
        totalAmount: { amount: subtotal, currencyCode: 'GBP' },
        totalTaxAmount: { amount: '0.00', currencyCode: 'GBP' },
        discountAmount,
      },
    },
  };
}

export class MockKokobayCartServer {
  private carts = new Map<string, MockCart>();
  private lineSeq = 0;
  private failNextRequests = 0;
  private authenticated401Once = false;
  refreshCallCount = 0;

  reset(): void {
    this.carts.clear();
    this.lineSeq = 0;
    this.failNextRequests = 0;
    this.authenticated401Once = false;
    this.refreshCallCount = 0;
  }

  queueNetworkFailures(count: number): void {
    this.failNextRequests = count;
  }

  enableAuthenticated401Once(): void {
    this.authenticated401Once = true;
  }

  clearDiscounts(guestId: string): void {
    const cart = this.carts.get(guestId);
    if (cart) cart.discountCodes = [];
  }

  private getOrCreateCart(guestId: string): MockCart {
    const existing = this.carts.get(guestId);
    if (existing) return existing;
    const id = `cart-${++this.lineSeq}`;
    const cart: MockCart = {
      id,
      guestId,
      checkoutUrl: `https://www.kokobay.co.uk/cart/c/${id}?key=test`,
      lines: [],
      discountCodes: [],
    };
    this.carts.set(guestId, cart);
    return cart;
  }

  private findLine(cart: MockCart, body: Record<string, unknown>): MockLine | undefined {
    const lineId = typeof body.lineId === 'string' ? body.lineId : undefined;
    const variantId = typeof body.variantId === 'string' ? body.variantId : undefined;
    if (lineId) return cart.lines.find((line) => line.id === lineId);
    if (variantId) return cart.lines.find((line) => line.variantId === variantId);
    return undefined;
  }

  handleRefresh(): { data: Record<string, unknown>; status: number } {
    this.refreshCallCount += 1;
    return {
      status: 200,
      data: {
        ok: true,
        sessionToken: 'refreshed-session-token',
        customer: {
          id: 'cust-1',
          email: 'shopper@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
      },
    };
  }

  route(
    method: string,
    path: string,
    body?: unknown,
    opts: RouteOpts = {},
  ): { data: Record<string, unknown>; status: number } {
    if (path.includes('/api/customer/auth/refresh')) {
      return this.handleRefresh();
    }

    if (this.failNextRequests > 0) {
      this.failNextRequests -= 1;
      throw new ApiError('Network request failed', { kind: 'network', url: path });
    }

    if (
      this.authenticated401Once &&
      opts.auth &&
      opts.auth !== 'guest-cart' &&
      opts.auth !== 'none'
    ) {
      this.authenticated401Once = false;
      throw new ApiError('Unauthorized', {
        kind: 'http',
        url: path,
        status: 401,
        body: { ok: false, code: 'unauthorized' },
      });
    }

    const guestId = opts.guestIdOverride?.trim() || 'guest-test-1';
    const routePath = path.split('?')[0] ?? path;
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const cart = this.getOrCreateCart(guestId);

    if (method === 'GET' && routePath === '/api/cart') {
      return { status: 200, data: cartPayload(cart) };
    }

    if (method === 'POST' && routePath === '/api/cart') {
      return { status: 200, data: cartPayload(cart) };
    }

    if (method === 'POST' && routePath === '/api/cart/items') {
      const variantId = String(payload.variantId ?? '');
      const quantity = Number(payload.quantity ?? 1);
      const meta =
        variantId === TEST_VARIANT_B
          ? { handle: TEST_HANDLE_B, title: 'Silk Scarf' }
          : { handle: TEST_HANDLE_A, title: 'Linen Midi Dress' };
      const existing = cart.lines.find((line) => line.variantId === variantId);
      if (existing) {
        existing.quantity += quantity;
        existing.cost.subtotalAmount.amount = (
          Number.parseFloat(existing.cost.amountPerQuantity.amount) * existing.quantity
        ).toFixed(2);
      } else {
        cart.lines.push(buildLine(cart, variantId, meta.handle, meta.title, quantity));
      }
      return { status: 200, data: cartPayload(cart) };
    }

    if (method === 'PATCH' && routePath === '/api/cart/items') {
      const line = this.findLine(cart, payload);
      const quantity = Number(payload.quantity ?? 0);
      if (!line) {
        return {
          status: 400,
          data: { ok: false, code: 'cart_error', error: 'Line not found' },
        };
      }
      if (quantity <= 0) {
        cart.lines = cart.lines.filter((entry) => entry.id !== line.id);
      } else {
        line.quantity = quantity;
        line.cost.subtotalAmount.amount = (
          Number.parseFloat(line.cost.amountPerQuantity.amount) * quantity
        ).toFixed(2);
      }
      return { status: 200, data: cartPayload(cart) };
    }

    if (method === 'DELETE' && routePath === '/api/cart/items') {
      const line = this.findLine(cart, payload);
      if (line) {
        cart.lines = cart.lines.filter((entry) => entry.id !== line.id);
      }
      return { status: 200, data: cartPayload(cart) };
    }

    if (method === 'DELETE' && routePath === '/api/cart') {
      cart.lines = [];
      cart.discountCodes = [];
      return { status: 200, data: { ok: true, cart: { id: cart.id, checkoutUrl: null, lines: [] } } };
    }

    if (method === 'POST' && routePath === '/api/cart/discount-code') {
      const code = String(payload.code ?? '').trim();
      if (code === 'INVALID') {
        return {
          status: 400,
          data: {
            ok: false,
            code: 'invalid_discount_code',
            error: 'This discount code is not valid.',
          },
        };
      }
      if (code === 'SAVE10') {
        cart.discountCodes = [
          { code: 'SAVE10', applicable: true, amount: { amount: '8.90', currencyCode: 'GBP' } },
        ];
        return { status: 200, data: cartPayload(cart) };
      }
      if (code === 'REMOVE') {
        cart.discountCodes = [];
        return { status: 200, data: cartPayload(cart) };
      }
      return {
        status: 400,
        data: { ok: false, code: 'invalid_discount_code', error: 'Unknown code' },
      };
    }

    return { status: 404, data: { ok: false, error: `Unhandled route ${method} ${routePath}` } };
  }
}
