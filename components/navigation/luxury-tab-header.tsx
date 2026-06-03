import { Link, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRenderTrace } from '@/hooks/use-render-trace';
import { LUXURY_SYMBOL } from '@/constants/luxury-icons';
import {
  KOKO_BAY_BRAND_TITLE,
  kokoBayBrandTitleStyle,
  LUXURY_HEADER_BODY_PX,
  LUXURY_HEADER_BORDER,
  luxuryChrome,
} from '@/constants/luxury-nav';

import { hapticLight } from '@/utils/haptics';

const TAB_CHROME_Z_INDEX = 221;

/** Fixed Koko Bay bar (incident banner is rendered by `AppGlobalShell`). */
export function LuxuryTabHeader() {
  useRenderTrace('Header');
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: TAB_CHROME_Z_INDEX,
        paddingTop: insets.top,
        backgroundColor: luxuryChrome.bg,
        borderBottomWidth: LUXURY_HEADER_BORDER,
        borderBottomColor: luxuryChrome.line,
        elevation: TAB_CHROME_Z_INDEX,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      }}>
      <View className="flex-row items-center px-3" style={{ height: LUXURY_HEADER_BODY_PX }}>
        <View className="min-w-0 flex-1" pointerEvents="none" />

        <View className="flex-shrink-0 px-1" pointerEvents="box-none">
          <Link href="/" asChild>
            <Pressable
              accessibilityRole="header"
              hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
              style={{ paddingVertical: 10, paddingHorizontal: 10 }}>
              <Text style={kokoBayBrandTitleStyle}>{KOKO_BAY_BRAND_TITLE}</Text>
            </Pressable>
          </Link>
        </View>

        <View className="min-w-0 flex-1 flex-row items-center justify-end" pointerEvents="box-none">
          <Pressable
            onPressIn={() => hapticLight()}
            onPress={() => router.push('/search-overlay')}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Search">
            <IconSymbol
              name="magnifyingglass"
              size={LUXURY_SYMBOL.chromeIconSize}
              color={luxuryChrome.ink}
              weight={LUXURY_SYMBOL.chromeWeight}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
