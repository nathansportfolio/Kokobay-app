import { AlertTriangle } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';
import { cn } from '@/utils/cn';

export type ErrorMessageProps = {
  title: string;
  message?: string;
  visible?: boolean;
  className?: string;
};

export function ErrorMessage({ title, message, visible = true, className }: ErrorMessageProps) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(formTokens.error.animationMs)}
      exiting={FadeOutUp.duration(formTokens.error.animationMs - 30)}
      className={cn(className)}
      style={{ marginBottom: formTokens.spacing.errorToForm }}>
      <View
        className="flex-row items-start gap-3"
        style={{
          backgroundColor: formTokens.error.background,
          borderColor: formTokens.error.border,
          borderWidth: 1,
          borderRadius: formTokens.error.borderRadius,
          paddingHorizontal: formTokens.error.paddingHorizontal,
          paddingVertical: formTokens.error.paddingVertical,
        }}>
        <AlertTriangle
          size={18}
          color={formTokens.error.text}
          strokeWidth={1.75}
          style={{ marginTop: 1 }}
        />
        <View className="flex-1">
          <Text
            className="font-sans-md text-[14px] leading-5 text-ink"
            style={{ marginBottom: message ? 4 : 0 }}>
            {title}
          </Text>
          {message ?
            <Text className="font-sans text-[13px] leading-[18px] text-mist">{message}</Text>
          : null}
        </View>
      </View>
    </Animated.View>
  );
}
