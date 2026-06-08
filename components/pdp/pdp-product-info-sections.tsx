import { PRODUCT_INFO_SECTIONS } from '@/constants/product-info-sections';
import { useMarketStore } from '@/store/market-preference';

import { PdpCmsAccordionSection } from './pdp-cms-accordion-section';

export function PdpProductInfoSections() {
  const countryCode = useMarketStore((s) => s.countryCode);

  return (
    <>
      {PRODUCT_INFO_SECTIONS.map((section) => {
        const countryInSlug = 'countryInSlug' in section && section.countryInSlug;
        const slug = countryInSlug
          ? `${section.slug}-${countryCode.trim().toLowerCase()}`
          : section.slug;

        return (
          <PdpCmsAccordionSection
            key={section.slug}
            slug={slug}
            omitCountry={countryInSlug}
            fallbackTitle={section.title}
            fallbackContent={'fallbackContent' in section ? section.fallbackContent : undefined}
            countryCode={countryCode}
            footerLink={'footerLink' in section ? section.footerLink : undefined}
          />
        );
      })}
    </>
  );
}
