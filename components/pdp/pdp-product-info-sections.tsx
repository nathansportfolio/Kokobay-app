import { PRODUCT_INFO_SECTIONS } from '@/constants/product-info-sections';
import { useMarketStore } from '@/store/market-preference';

import { PdpCmsAccordionSection } from './pdp-cms-accordion-section';

export function PdpProductInfoSections() {
  const countryCode = useMarketStore((s) => s.countryCode);

  return (
    <>
      {PRODUCT_INFO_SECTIONS.map((section) => (
        <PdpCmsAccordionSection
          key={section.slug}
          slug={section.slug}
          fallbackTitle={section.title}
          countryCode={countryCode}
          footerLink={'footerLink' in section ? section.footerLink : undefined}
        />
      ))}
    </>
  );
}
