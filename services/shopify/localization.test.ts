import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { marketOptionsFromCountries } from '@/services/shopify/localization';

describe('marketOptionsFromCountries', () => {
  it('dedupes currencies and prefers representative countries', () => {
    const options = marketOptionsFromCountries([
      {
        isoCode: 'IE',
        name: 'Ireland',
        currency: { isoCode: 'EUR', name: 'Euro' },
      },
      {
        isoCode: 'FR',
        name: 'France',
        currency: { isoCode: 'EUR', name: 'Euro' },
      },
      {
        isoCode: 'US',
        name: 'United States',
        currency: { isoCode: 'USD', name: 'US Dollar' },
      },
      {
        isoCode: 'GB',
        name: 'United Kingdom',
        currency: { isoCode: 'GBP', name: 'British Pound' },
      },
    ]);

    assert.deepEqual(options.map((o) => o.currencyCode).sort(), ['EUR', 'GBP', 'USD']);
    assert.equal(options.find((o) => o.currencyCode === 'EUR')?.countryCode, 'IE');
    assert.equal(options.find((o) => o.currencyCode === 'USD')?.countryCode, 'US');
  });
});
