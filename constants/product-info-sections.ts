import { HOW_TO_RETURN_URL } from '@/constants/legal-urls';
import { PDP_DELIVERY_COPY, PDP_RETURNS_COPY } from '@/constants/pdp-copy';

/** PDP accordion slices — add entries here to surface new CMS `app_content` slugs. */
export const PRODUCT_INFO_SECTIONS = [
  {
    slug: 'returns-info',
    title: 'Returns Information',
    fallbackContent: PDP_RETURNS_COPY,
    footerLink: { label: 'Full returns info here', url: HOW_TO_RETURN_URL },
  },
  {
    slug: 'shipping-info',
    countryInSlug: true,
    title: 'Shipping Information',
    fallbackContent: PDP_DELIVERY_COPY,
  },
  { slug: 'size-guide', title: 'Size Guide' },
] as const;

export type ProductInfoSection = (typeof PRODUCT_INFO_SECTIONS)[number];
