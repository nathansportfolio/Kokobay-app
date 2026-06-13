import type { LuxuryCardActionSize } from '@/components/ui/luxury-card-action-surface';

export type ProductCardActionScale = {
  surfaceSize: LuxuryCardActionSize;
  iconSize: number;
  inset: number;
};

const ICON_BY_SIZE: Record<LuxuryCardActionSize, number> = {
  xs: 14,
  sm: 16,
  md: 18,
};

const INSET_BY_SIZE: Record<LuxuryCardActionSize, number> = {
  xs: 8,
  sm: 12,
  md: 16,
};

/** Scales wishlist / quick-add overlays with tile width — smaller cards get smaller controls. */
export function resolveProductCardActionScale(
  tileWidth?: number,
  gridColumns: 1 | 2 = 2,
): ProductCardActionScale {
  let surfaceSize: LuxuryCardActionSize;

  if (tileWidth != null && tileWidth > 0) {
    if (tileWidth < 155) {
      surfaceSize = 'xs';
    } else if (tileWidth < 200) {
      surfaceSize = 'sm';
    } else {
      surfaceSize = 'md';
    }
  } else {
    surfaceSize = gridColumns === 1 ? 'md' : 'sm';
  }

  return {
    surfaceSize,
    iconSize: ICON_BY_SIZE[surfaceSize],
    inset: INSET_BY_SIZE[surfaceSize],
  };
}
