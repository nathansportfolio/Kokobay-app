import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCmsCountryContentSlug } from '@/utils/cms-country-content-slug';

describe('buildCmsCountryContentSlug', () => {
  it('appends lowercase country to base slug', () => {
    assert.equal(
      buildCmsCountryContentSlug('app-cart-delivery-text', 'GB'),
      'app-cart-delivery-text-gb',
    );
    assert.equal(buildCmsCountryContentSlug('shipping-info', 'US'), 'shipping-info-us');
  });
});
