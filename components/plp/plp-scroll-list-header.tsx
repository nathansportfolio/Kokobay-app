import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LuxuryTabBodySpacer } from '@/components/navigation/luxury-tab-body-spacer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { luxuryChrome } from '@/constants/luxury-nav';
import { palette } from '@/constants/theme';

const CHROME_BAR = {
  paddingBottom: 14,
  backgroundColor: luxuryChrome.bg,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: luxuryChrome.line,
} as const;

type PlpScrollListHeaderProps = {
  onBack: () => void;
  backAccessibilityLabel: string;
  title: ReactNode;
  toolbar: ReactNode;
};

/** PLP list header — same top clearance as wishlist / account (`LuxuryTabBodySpacer`). */
export function PlpScrollListHeader({
  onBack,
  backAccessibilityLabel,
  title,
  toolbar,
}: PlpScrollListHeaderProps) {
  return (
    <>
      <LuxuryTabBodySpacer />
      <View style={CHROME_BAR}>
        <View className="relative min-h-[48px] items-center justify-center px-14">
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            hitSlop={14}
            className="absolute bottom-0 left-4 top-0 z-10 justify-center p-1 active:opacity-70">
            <IconSymbol name="chevron.left" size={18} color={palette.ink} />
          </Pressable>
          <View className="items-center px-2">{title}</View>
        </View>
      </View>
      {toolbar}
    </>
  );
}
