import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppErrorBannerChromeHeight } from '@/hooks/use-app-error-banner-content';
import { LUXURY_TAB_HEADER_CONTENT_GAP, tabHeaderRowHeight } from '@/constants/luxury-nav';

/** Clears the fixed tab header (status bar + chrome + optional incident banner) before content. */
export function LuxuryTabBodySpacer() {
  const insets = useSafeAreaInsets();
  const bannerHeight = useAppErrorBannerChromeHeight();
  return (
    <View
      style={{
        height:
          insets.top + tabHeaderRowHeight() + bannerHeight + LUXURY_TAB_HEADER_CONTENT_GAP,
      }}
    />
  );
}
