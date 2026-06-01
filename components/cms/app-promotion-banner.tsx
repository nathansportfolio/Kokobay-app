import { View } from 'react-native';

import { Text } from '@/components/ui/text';
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
        backgroundColor: '#141414',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
      }}>
      <View className="px-4 py-3">
        <Text
          className="text-center font-sans text-[14px] leading-5 text-white"
          style={{ color: '#FFFFFF' }}>
          {message}
        </Text>
      </View>
    </View>
  );
}
