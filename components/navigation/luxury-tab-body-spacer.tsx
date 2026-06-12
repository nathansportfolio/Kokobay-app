import { View } from 'react-native';

import { useScrollTopPadding } from '@/contexts/chrome-context';

/** Clears the fixed tab header (status bar + chrome + optional incident banner) before content. */
export function LuxuryTabBodySpacer() {
  const spacerHeight = useScrollTopPadding();
  return <View style={{ height: spacerHeight }} />;
}
