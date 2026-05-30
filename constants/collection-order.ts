import { ALL_PRODUCTS_COLLECTION_HANDLE } from '@/constants/catalog';

/**
 * Controls collection order on the Collections tab, home, and `getCollections()`.
 *
 * Each entry is one slot. Put handle aliases in the same group (e.g. live `all-new-in` and
 * editorial `new-in`). Collections not listed here appear after these groups, A–Z by title.
 */
export const COLLECTION_PRIORITY_GROUPS: readonly (readonly string[])[] = [
  ['all-new-in', 'new-in'],
  [ALL_PRODUCTS_COLLECTION_HANDLE],
  ['featured'],
  ['best-sellers', 'best-selling-products'],
  ['dresses'],
  ['knitwear'],
  ['swimwear'],
  ['co-ords'],
  ['loungewear-1', 'loungewear'],
];
