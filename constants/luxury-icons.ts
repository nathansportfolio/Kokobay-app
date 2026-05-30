/** Editorial chrome — sizes align with Lucide tab bar (`app/(tabs)/_layout.tsx`). */
export const LUXURY_SYMBOL = {
  /** Slightly larger for 5-up tab bar — easier to tap without crowding labels. */
  tabIconSize: 24,
  chromeIconSize: 21,
  /** Passed to `IconSymbol` / Lucide as semantic stroke (maps in `icon-symbol`). */
  chromeWeight: 'thin' as const,
  tabWeightActive: 'light' as const,
  tabWeightInactive: 'thin' as const,
};
