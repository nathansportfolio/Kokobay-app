import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOAST_LAYOUT, TOAST_VARIANTS } from '@/constants/toast-theme';
import { useToastStore } from '@/store/toast';

/** Gap below status bar / notch */
const TOP_TOAST_PAD = 10;

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const toast = useToastStore((s) => s.toast);
  const visible = useToastStore((s) => s.visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 220 });
  }, [visible, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    /** Hidden: slightly above; visible: flush — reads as dropping in from the top */
    transform: [{ translateY: (progress.value - 1) * 14 }],
  }));

  if (!toast) {
    return null;
  }

  const theme = TOAST_VARIANTS[toast.variant];
  const Icon = theme.Icon;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.layer]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.bubble,
          {
            maxWidth: TOAST_LAYOUT.maxWidth,
            paddingHorizontal: TOAST_LAYOUT.paddingHorizontal,
            paddingVertical: TOAST_LAYOUT.paddingVertical,
            borderRadius: TOAST_LAYOUT.borderRadius,
            borderWidth: TOAST_LAYOUT.borderWidth,
            backgroundColor: theme.backgroundColor,
            borderColor: theme.borderColor,
          },
          TOAST_LAYOUT.shadow,
          { marginTop: insets.top + TOP_TOAST_PAD },
          animatedStyle,
        ]}>
        <View style={[styles.row, { gap: TOAST_LAYOUT.gap }]}>
          <Icon
            size={TOAST_LAYOUT.iconSize}
            color={theme.iconColor}
            strokeWidth={2}
            pointerEvents="none"
          />
          <View style={styles.copy}>
            <Text
              style={[
                styles.title,
                TOAST_LAYOUT.title,
                { color: theme.titleColor },
              ]}>
              {toast.title}
            </Text>
            {toast.description ? (
              <Text
                style={[
                  styles.description,
                  TOAST_LAYOUT.description,
                  { color: theme.descriptionColor },
                ]}>
                {toast.description}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 20000,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bubble: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    textAlign: 'left',
  },
  description: {
    textAlign: 'left',
  },
});
