/**
 * Editorial colour families — maps Shopify / variant colour strings to grouped filter chips.
 * Matching is case-insensitive. Values can belong to more than one group (e.g. “Black & White”).
 */
export const COLOUR_GROUP_DEFINITIONS: ReadonlyArray<{
  readonly group: string;
  readonly members: readonly string[];
}> = [
  {
    group: 'Beige',
    members: ['Apricot', 'Beige', 'Cream', 'Oatmeal', 'Sand', 'Biscuit', 'Champagne', 'Nude'],
  },
  {
    group: 'Black',
    members: [
      'Black',
      'Black & White',
      'Black & White Crochet',
      'Black & White Floral',
      'Black Floral',
      'Black Velvet',
    ],
  },
  {
    group: 'Blue',
    members: ['Blue', 'Blue & Purple Floral', 'Blue Floral', 'Blueberry Cream', 'Navy', 'Teal', 'Cobalt'],
  },
  {
    group: 'Brown',
    members: ['Brown', 'Camel', 'Chocolate', 'Dark Taupe', 'Mocha', 'Mocha Melt', 'Tan', 'Taupe', 'Cocoa', 'Espresso'],
  },
  {
    group: 'Green',
    members: ['Eden', 'Green', 'Khaki', 'Sage', 'Olive', 'Emerald', 'Mint'],
  },
  {
    group: 'Grey',
    members: ['Grey', 'Gray', 'Silver', 'Charcoal', 'Slate', 'Ash', 'Smoke', 'Heather Grey'],
  },
  {
    group: 'Pink',
    members: ['Blush', 'Pink', 'Pink Floral', 'Rose', 'Fuchsia'],
  },
  {
    group: 'Printed',
    members: [
      'Printed',
      'Floral',
      'Leopard',
      'Polka Dot',
      'Print',
      'Rio',
      'Animal print',
      'Abstract',
    ],
  },
  {
    group: 'Purple',
    members: ['Mauve', 'Plum', 'Purple', 'Lilac', 'Violet'],
  },
  {
    group: 'Red',
    members: ['Cherry Swirl', 'Red', 'Strawberry Sorbet', 'Wine', 'Burgundy', 'Crimson'],
  },
  {
    group: 'White',
    members: [
      'Black & White',
      'Pearl',
      'Stone',
      'White',
      'White Floral',
      'Ivory',
      'Off White',
      'Snow',
    ],
  },
  {
    group: 'Yellow',
    members: [
      'Lemon',
      'Lemon floral',
      'Lemon Floral',
      'Lemon Sorbet',
      'Paisley',
      'Gold',
      'Mustard',
      'Butter',
      'Yellow',
      'Yellow & Brown Floral',
    ],
  },
] as const;

/** Circle swatch fill per colour family (matches storefront theme). */
export const COLOUR_GROUP_SWATCH_HEX: Readonly<Record<string, string>> = {
  black: '#111111',
  white: '#F8F8F6',
  beige: '#E8E0D4',
  brown: '#7A5C48',
  blue: '#4A6A8A',
  red: '#A63434',
  yellow: '#D8C25A',
  green: '#5E7251',
  pink: '#D8A7B1',
  grey: '#8B8B8B',
  purple: '#6E5875',
  printed: '#D9D2C7',
};

export const COLOUR_GROUP_SWATCH_FALLBACK_HEX = '#D8D8D8';

/** Stable chip order; any label not listed sorts after, alphabetically. */
export const COLOUR_GROUP_SORT_ORDER: readonly string[] = [
  'Beige',
  'Black',
  'Blue',
  'Brown',
  'Green',
  'Grey',
  'Pink',
  'Printed',
  'Purple',
  'Red',
  'White',
  'Yellow',
];
