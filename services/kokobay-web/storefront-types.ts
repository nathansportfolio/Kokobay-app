/** Shapes returned by Koko Bay web Storefront search routes (`/api/search`, `/api/search/predictive`). */

export type KokobayStorefrontMoney = {
  amount: string;
  currencyCode: string;
};

export type KokobayStorefrontImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
} | null;

export type KokobayStorefrontVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: KokobayStorefrontMoney;
  compareAtPrice: KokobayStorefrontMoney | null;
  selectedOptions: { name: string; value: string }[];
};

export type KokobayStorefrontPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export type KokobayStorefrontProduct = {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  tags?: string[];
  productType?: string | null;
  description?: string | null;
  descriptionHtml?: string | null;
  availableForSale: boolean;
  featuredImage: KokobayStorefrontImage;
  images?: KokobayStorefrontImage[];
  priceRange: {
    minVariantPrice: KokobayStorefrontMoney;
    maxVariantPrice: KokobayStorefrontMoney;
  };
  compareAtPriceRange?: {
    minVariantPrice: KokobayStorefrontMoney | null;
    maxVariantPrice: KokobayStorefrontMoney | null;
  };
  variants: KokobayStorefrontVariant[];
};

export type KokobayStorefrontProductPreview = Pick<
  KokobayStorefrontProduct,
  'id' | 'title' | 'handle' | 'vendor' | 'availableForSale' | 'featuredImage'
> & {
  priceRange: {
    minVariantPrice: KokobayStorefrontMoney;
    maxVariantPrice: KokobayStorefrontMoney;
  };
};

export type KokobayStorefrontCollectionSummary = {
  id: string;
  handle: string;
  title: string;
  image: KokobayStorefrontImage;
};

export type KokobayStorefrontFilterValue = {
  id: string;
  label: string;
  count: number;
  /** JSON string matching Shopify `ProductFilter` — pass back as `filter` query param. */
  input: string;
};

export type KokobayStorefrontFilter = {
  id: string;
  label: string;
  type: string;
  values: KokobayStorefrontFilterValue[];
};

export type KokobayPaginatedProductsJson = {
  query?: string;
  products: KokobayStorefrontProductPreview[];
  totalCount?: number;
  pagination: {
    first: number;
    pageInfo: KokobayStorefrontPageInfo;
  };
  sort?: unknown;
};

export type KokobayProductDetailJson = {
  product: KokobayStorefrontProduct;
};

export type KokobayCollectionProductsJson = {
  collection: {
    id: string;
    handle: string;
    title: string;
    description?: string | null;
    descriptionHtml?: string | null;
    image?: KokobayStorefrontImage;
  } | null;
  products: KokobayStorefrontProductPreview[];
  totalCount?: number;
  pagination: {
    first: number;
    pageInfo: KokobayStorefrontPageInfo;
  };
  filters?: KokobayStorefrontFilter[];
  sort?: unknown;
};

export type KokobaySearchJson = {
  query: string;
  products: KokobayStorefrontProductPreview[];
  totalCount?: number;
  pagination: {
    first: number;
    pageInfo: KokobayStorefrontPageInfo;
  };
  productFilters?: KokobayStorefrontFilter[];
  filters?: KokobayStorefrontFilter[];
};

export type KokobayPredictiveSearchJson = {
  query: string;
  products: KokobayStorefrontProductPreview[];
  collections: KokobayStorefrontCollectionSummary[];
  suggestions: { text: string; styledText: string }[];
};

export type KokobayProductRecommendationIntent = 'RELATED' | 'COMPLEMENTARY';

export type KokobayRecommendationsJson = {
  intent: KokobayProductRecommendationIntent;
  productId: string | null;
  handle: string | null;
  products: KokobayStorefrontProductPreview[];
};
