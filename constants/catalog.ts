import type { Collection } from '@/types/shopify';

/** Virtual room used with Storefront `products(query: "*")` and Koko Bay `/api/products`. */
export const ALL_PRODUCTS_COLLECTION_HANDLE = 'all-products' as const;

export const ALL_PRODUCTS_COLLECTION: Collection = {
  id: 'gid://kokobay/Collection/all-products',
  handle: ALL_PRODUCTS_COLLECTION_HANDLE,
  title: 'All Products',
  description: 'Every piece in the catalog — browse the full assortment.',
  descriptionHtml: '<p>Every piece in the catalog — browse the full assortment.</p>',
  image: null,
};
