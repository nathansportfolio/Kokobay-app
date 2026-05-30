/**
 * Single source of truth for spacing / radii used in StyleSheet-heavy surfaces.
 * Tailwind screens should mirror these values (see `tailwind.config.js` warm* colors).
 */
export const LUXURY_SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 28,
} as const;

export const LUXURY_RADIUS = {
  md: 16,
  lg: 24,
  xl: 28,
  sheetTop: 24,
  pill: 9999,
} as const;

export const LUXURY_WARM = {
  canvas: '#FAF8F5',
  surface: '#F7F4EF',
  elevated: '#F5F3F0',
} as const;
