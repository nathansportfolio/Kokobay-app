import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { KokobayStorefrontFilter } from '@/services/kokobay-web/storefront-types';

import {
  createStorefrontFilterLookup,
  facetsFromStorefrontFilters,
  resolveColourFilterInputsForSelection,
} from '@/utils/storefront-filters';

const printedGroupFilter = JSON.stringify({
  variantOption: {
    name: 'color',
    value: 'gid://shopify/FilterSettingGroup/392626562',
  },
});

const polkaDotFilter = JSON.stringify({
  variantOption: { name: 'color', value: 'Polka dot' },
});

const colorFilters: KokobayStorefrontFilter[] = [
  {
    id: 'color',
    label: 'Color',
    type: 'LIST',
    values: [
      {
        id: 'printed',
        label: 'Printed',
        count: 25,
        input: printedGroupFilter,
      },
      {
        id: 'polka-1',
        label: 'Polka dot',
        count: 4,
        input: polkaDotFilter,
      },
      {
        id: 'polka-2',
        label: 'polka dot',
        count: 4,
        input: JSON.stringify({
          variantOption: { name: 'color', value: 'polka dot' },
        }),
      },
    ],
  },
];

describe('storefront colour filters', () => {
  it('uses the named Shopify group count without inflating from child labels', () => {
    const facets = facetsFromStorefrontFilters(colorFilters);
    assert.equal(facets.colourGroupCounts.Printed, 25);
  });

  it('sends only the named Printed group filter, not child AND filters', () => {
    const lookup = createStorefrontFilterLookup(colorFilters);
    const inputs = resolveColourFilterInputsForSelection(['Printed'], lookup);
    assert.deepEqual(inputs, [printedGroupFilter]);
  });
});
