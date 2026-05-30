/** PDP accordion slices — add entries here to surface new CMS `app_content` slugs. */
export const PRODUCT_INFO_SECTIONS = [
  { slug: 'returns-info', title: 'Returns Information' },
  { slug: 'shipping-info', title: 'Shipping Information' },
  { slug: 'size-guide', title: 'Size Guide' },
] as const;

export type ProductInfoSection = (typeof PRODUCT_INFO_SECTIONS)[number];
