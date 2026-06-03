import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CartLine } from '@/types/cart';

import {
  APP_CHECKOUT_SOURCE,
  buildOnlineStoreCartPermalinkUrl,
  resolveCheckoutWebViewUrl,
  withAppCheckoutSource,
} from './checkout-url';

const sampleLine: CartLine = {
  handle: 'test',
  variantId: 'gid://shopify/ProductVariant/123456789',
  qty: 1,
};

describe('withAppCheckoutSource', () => {
  it('appends source=app to checkout URLs', () => {
    const out = withAppCheckoutSource('https://www.kokobay.co.uk/cart/c/abc?key=1');
    assert.equal(new URL(out).searchParams.get('source'), APP_CHECKOUT_SOURCE);
  });

  it('is idempotent', () => {
    const once = withAppCheckoutSource('https://www.kokobay.co.uk/checkout');
    const twice = withAppCheckoutSource(once);
    assert.equal(once, twice);
  });
});

describe('resolveCheckoutWebViewUrl', () => {
  it('tags Storefront checkout URLs', () => {
    const url = resolveCheckoutWebViewUrl(
      'https://www.kokobay.co.uk/cart/c/abc?key=1',
      [sampleLine],
    );
    assert.ok(url);
    assert.equal(new URL(url!).searchParams.get('source'), APP_CHECKOUT_SOURCE);
  });

  it('tags cart permalink fallback without empty checkout param', () => {
    const url = resolveCheckoutWebViewUrl(null, [sampleLine]);
    assert.ok(url);
    assert.equal(new URL(url!).searchParams.get('source'), APP_CHECKOUT_SOURCE);
    assert.equal(new URL(url!).searchParams.has('checkout'), false);
    assert.match(url!, /\/cart\/123456789:1\?source=app$/);
  });
});

describe('buildOnlineStoreCartPermalinkUrl', () => {
  it('includes source=app only (no empty checkout param)', () => {
    const url = buildOnlineStoreCartPermalinkUrl([sampleLine]);
    assert.ok(url);
    const parsed = new URL(url!);
    assert.equal(parsed.searchParams.get('source'), APP_CHECKOUT_SOURCE);
    assert.equal(parsed.searchParams.has('checkout'), false);
  });
});
