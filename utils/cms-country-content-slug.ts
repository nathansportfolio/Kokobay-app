/** `app-cart-delivery-text-gb` — regional CMS slug (matches shipping-info-{country}). */
export function buildCmsCountryContentSlug(baseSlug: string, countryCode: string): string {
  const base = baseSlug.trim();
  const country = countryCode.trim().toLowerCase();
  if (!base || !country) return base;
  return `${base}-${country}`;
}
