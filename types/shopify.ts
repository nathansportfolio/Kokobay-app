/** Normalized Storefront API shapes used by `services/shopify` */

export type Money = {
  amount: string;
  currencyCode: string;
};

export type Image = {
  id?: string;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  /** Catalog inventory count when exposed by the API (Mongo admin path). */
  quantityAvailable?: number | null;
  price: Money;
  compareAtPrice?: Money | null;
  selectedOptions: { name: string; value: string }[];
  image?: Image | null;
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  availableForSale: boolean;
  vendor?: string;
  productType?: string;
  tags: string[];
  images: Image[];
  variants: ProductVariant[];
  priceRange: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  };
};

export type Collection = {
  id: string;
  handle: string;
  title: string;
  description?: string;
  descriptionHtml?: string;
  image?: Image | null;
};
