import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';

/** Extra vertical hit area without widening into adjacent tabs (avoids mis-taps). */
const TAB_HIT_SLOP = { top: 10, bottom: 12, left: 0, right: 0 } as const;

export function HapticTab({ style, onPressIn, ...rest }: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...rest}
      style={[style, styles.tabPressable]}
      hitSlop={TAB_HIT_SLOP}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
    />
  );
}

const styles = StyleSheet.create({
  /** Centers the tab icon in the slot for a larger vertical tap target. */
  tabPressable: {
    justifyContent: 'center',
  },
});
