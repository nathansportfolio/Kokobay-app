import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { APP_PROMOTION_BANNER_STRIP_HEIGHT } from '@/constants/app-promotion-banner';
import { useAppPromotionBannerContent } from '@/hooks/use-app-promotion-banner-content';

/** Promotion strip — black background, white text (below header, above incident banner). */
export function AppPromotionBannerStrip() {
  const { visible, message } = useAppPromotionBannerContent();

  if (!visible) {
    return null;
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{
        height: APP_PROMOTION_BANNER_STRIP_HEIGHT,
        justifyContent: 'center',
        backgroundColor: '#141414',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
      }}>
      <Text
        className="px-4 text-center font-sans text-[14px] leading-5 text-white"
        numberOfLines={2}
        style={{ color: '#FFFFFF' }}>
        {message}
      </Text>
    </View>
  );
}
