import type { ReactNode } from 'react';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import { hapticSelection } from '@/utils/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type PdpAccordionProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function PdpAccordion({ title, defaultOpen = false, children }: PdpAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    hapticSelection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View className="border-b border-line/40">
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center justify-between py-4 active:opacity-78">
        <Text className="pr-4 font-sans-md text-[11px] uppercase tracking-[0.28em] text-ink">
          {title}
        </Text>
        <IconSymbol
          name="chevron.down"
          size={12}
          color={palette.muted}
          style={{ opacity: 0.72, transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {open ? <View className="pb-5 pt-0">{children}</View> : null}
    </View>
  );
}
