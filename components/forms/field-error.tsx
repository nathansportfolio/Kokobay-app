import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { formTokens } from '@/constants/form-tokens';

export type FieldErrorProps = {
  message?: string;
};

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(formTokens.error.animationMs)}
      exiting={FadeOutUp.duration(formTokens.error.animationMs - 30)}
      style={{ marginTop: formTokens.error.fieldMarginTop }}>
      <View
        style={{
          backgroundColor: formTokens.error.background,
          borderColor: formTokens.error.border,
          borderWidth: 1,
          borderRadius: formTokens.error.borderRadius,
          paddingHorizontal: formTokens.error.fieldPaddingHorizontal,
          paddingVertical: formTokens.error.fieldPaddingVertical,
        }}>
        <Text
          className="font-sans"
          style={{
            fontSize: formTokens.error.fieldFontSize,
            lineHeight: 18,
            color: formTokens.error.text,
          }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
