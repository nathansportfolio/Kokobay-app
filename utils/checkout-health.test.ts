import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getCheckoutUnavailableCopy,
  isCheckoutAvailable,
  recordCheckoutHealthInvalid,
  resetCheckoutHealthEscalationForTests,
  shouldShowShopifyOutageMessage,
} from './checkout-health';

describe('isCheckoutAvailable', () => {
  it('rejects null, undefined, and empty', () => {
    assert.equal(isCheckoutAvailable(null), false);
    assert.equal(isCheckoutAvailable(undefined), false);
    assert.equal(isCheckoutAvailable(''), false);
    assert.equal(isCheckoutAvailable('   '), false);
  });

  it('rejects URLs shorter than 20 characters', () => {
    assert.equal(isCheckoutAvailable('https://a.co/x'), false);
  });

  it('rejects broken cart permalinks with empty checkout query', () => {
    assert.equal(
      isCheckoutAvailable('https://www.kokobay.co.uk/cart/123:1?checkout='),
      false,
    );
    assert.equal(
      isCheckoutAvailable('https://www.kokobay.co.uk/cart/123:1?source=app&checkout='),
      false,
    );
  });

  it('accepts Storefront cart checkout URLs', () => {
    assert.equal(
      isCheckoutAvailable(
        'https://www.kokobay.co.uk/cart/c/abc123def456?key=samplekeyvalue',
      ),
      true,
    );
  });

  it('accepts healthy cart permalinks without empty checkout param', () => {
    assert.equal(
      isCheckoutAvailable('https://www.kokobay.co.uk/cart/123456789:1?source=app'),
      true,
    );
  });
});

describe('checkout unavailable copy escalation', () => {
  it('shows Shopify outage copy after repeated invalid detections', () => {
    resetCheckoutHealthEscalationForTests();
    recordCheckoutHealthInvalid();
    recordCheckoutHealthInvalid();
    assert.equal(shouldShowShopifyOutageMessage(), false);
    recordCheckoutHealthInvalid();
    assert.equal(shouldShowShopifyOutageMessage(), true);
    const copy = getCheckoutUnavailableCopy();
    assert.match(copy.message, /Shopify checkout is currently unavailable/i);
  });
});
