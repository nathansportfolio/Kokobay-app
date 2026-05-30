import { forwardRef, useCallback, type ElementRef } from 'react';
import { ActivityIndicator, Pressable, PressableProps, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { formTokens } from '@/constants/form-tokens';
import { palette } from '@/constants/theme';
import { cn } from '@/utils/cn';
import { hapticLight } from '@/utils/haptics';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'default' | 'form';

const variantClass: Record<Variant, string> = {
  primary: 'bg-ink',
  secondary: 'border border-line/55 bg-warmSurface/60',
  ghost: 'bg-transparent',
};

const formVariantClass: Partial<Record<Variant, string>> = {
  secondary: 'border-formBorder bg-formBg',
};

const labelClass: Record<Variant, string> = {
  primary: 'text-canvas font-sans-md',
  secondary: 'text-ink font-sans-md',
  ghost: 'text-ink font-sans-md',
};

const spinnerColor: Record<Variant, string> = {
  primary: palette.canvas,
  secondary: palette.ink,
  ghost: palette.ink,
};

const sizeClass: Record<Size, string> = {
  default: 'min-h-[52px] rounded-full px-7 py-3.5',
  form: 'min-h-[56px] rounded-[28px] px-5',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  textClassName?: string;
};

export const Button = forwardRef<ElementRef<typeof Pressable>, ButtonProps>(
  (
    {
      title,
      variant = 'primary',
      size = 'default',
      loading = false,
      className,
      textClassName,
      disabled,
      onPressIn,
      onPressOut,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(
      (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
        if (!isDisabled) {
          hapticLight();
          scale.value = withTiming(0.98, { duration: 100 });
        }
        onPressIn?.(event);
      },
      [isDisabled, onPressIn, scale],
    );

    const handlePressOut = useCallback(
      (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
        scale.value = withTiming(1, { duration: formTokens.input.transitionMs });
        onPressOut?.(event);
      },
      [onPressOut, scale],
    );

    return (
      <AnimatedPressable
        ref={ref}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={animatedStyle}
        className={cn(
          'items-center justify-center',
          sizeClass[size],
          variantClass[variant],
          size === 'form' && formVariantClass[variant],
          variant === 'primary' && 'active:opacity-90',
          variant === 'secondary' && size === 'default' && 'rounded-2xl active:bg-warmElevated',
          variant === 'secondary' && size === 'form' && 'active:bg-warmElevated',
          variant === 'ghost' && size === 'default' && 'rounded-2xl active:bg-warmElevated/70',
          variant === 'ghost' && size === 'form' && 'active:bg-warmElevated/70',
          isDisabled && 'opacity-40',
          className,
        )}
        {...rest}>
        <View className="flex-row items-center justify-center gap-2.5">
          {loading ? (
            <ActivityIndicator size="small" color={spinnerColor[variant]} />
          ) : (
            <Text
              className={cn(
                size === 'form' ? 'text-[15px] tracking-[0.04em]' : 'text-[14px] tracking-[0.06em]',
                labelClass[variant],
                textClassName,
              )}>
              {title}
            </Text>
          )}
        </View>
      </AnimatedPressable>
    );
  },
);

Button.displayName = 'Button';
