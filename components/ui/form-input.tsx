import { forwardRef, useCallback, useEffect, type ElementRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useFormFieldError, useFormFieldFocus } from '@/components/ui/form-field';
import { formTokens } from '@/constants/form-tokens';
import { cn } from '@/utils/cn';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export type FormInputProps = TextInputProps & {
  secure?: boolean;
  className?: string;
  onFocusChange?: (focused: boolean) => void;
};

export const FormInput = forwardRef<ElementRef<typeof TextInput>, FormInputProps>(
  (
    {
      secure = false,
      className,
      onFocus,
      onBlur,
      onFocusChange,
      placeholderTextColor = formTokens.input.placeholder,
      style,
      ...rest
    },
    ref,
  ) => {
    const hasError = useFormFieldError();
    const focused = useSharedValue(0);
    const errored = useSharedValue(hasError ? 1 : 0);

    useEffect(() => {
      errored.value = withTiming(hasError ? 1 : 0, { duration: formTokens.error.animationMs });
    }, [errored, hasError]);

    const animatedStyle = useAnimatedStyle(() => {
      const borderColor = interpolateColor(
        errored.value,
        [0, 1],
        [
          interpolateColor(focused.value, [0, 1], [formTokens.input.border, formTokens.input.borderFocused]),
          formTokens.error.inputBorder,
        ],
      );

      const backgroundColor = interpolateColor(
        errored.value,
        [0, 1],
        [formTokens.input.background, formTokens.error.inputBackground],
      );

      const borderWidth = interpolate(
        errored.value,
        [0, 1],
        [
          interpolate(
            focused.value,
            [0, 1],
            [formTokens.input.borderWidth, formTokens.input.borderWidthFocused],
          ),
          formTokens.input.borderWidthFocused,
        ],
      );

      return {
        borderColor,
        backgroundColor,
        borderWidth,
        shadowOpacity: errored.value > 0 ? 0 : focused.value * formTokens.shadow.shadowOpacity,
        shadowRadius: errored.value > 0 ? 0 : focused.value * formTokens.shadow.shadowRadius,
      };
    }, [secure]);

    const notifyFocusChange = useFormFieldFocus(onFocusChange);

    const handleFocus = useCallback(
      (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
        focused.value = withTiming(1, { duration: formTokens.input.transitionMs });
        notifyFocusChange(true);
        onFocus?.(event);
      },
      [focused, notifyFocusChange, onFocus],
    );

    const handleBlur = useCallback(
      (event: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
        focused.value = withTiming(0, { duration: formTokens.input.transitionMs });
        notifyFocusChange(false);
        onBlur?.(event);
      },
      [focused, notifyFocusChange, onBlur],
    );

    return (
      <AnimatedTextInput
        ref={ref}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholderTextColor={placeholderTextColor}
        className={cn('font-sans text-ink', className)}
        style={[
          {
            height: formTokens.input.height,
            borderRadius: formTokens.input.borderRadius,
            paddingHorizontal: formTokens.input.paddingHorizontal,
            fontSize: formTokens.input.fontSize,
            shadowColor: formTokens.shadow.shadowColor,
            shadowOffset: formTokens.shadow.shadowOffset,
            elevation: formTokens.shadow.elevation,
          },
          animatedStyle,
          style,
        ]}
        {...rest}
      />
    );
  },
);

FormInput.displayName = 'FormInput';
