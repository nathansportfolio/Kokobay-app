import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/constants/theme';
import { cn } from '@/utils/cn';

export type SkeletonProps = {
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ className, style }: SkeletonProps) {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100 }),
        withTiming(0.52, { duration: 1100 }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View
      style={[animatedStyle, { backgroundColor: palette.elevated }, style]}
      className={cn('rounded-sm', className)}
    />
  );
}
