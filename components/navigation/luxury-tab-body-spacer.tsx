import { View } from 'react-native';

import { useTabContentTopSpacerHeight } from '@/hooks/use-luxury-chrome-top-padding';

/** Clears the fixed tab header (status bar + chrome + optional incident banner) before content. */
export function LuxuryTabBodySpacer() {
  const spacerHeight = useTabContentTopSpacerHeight();
  return <View style={{ height: spacerHeight }} />;
}
