import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';
import { cn } from '@/utils/cn';

type AuthFormHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
};

export function AuthFormHeader({ eyebrow, title, subtitle, className }: AuthFormHeaderProps) {
  return (
    <View className={cn(className)} style={{ marginBottom: formTokens.spacing.descriptionToForm }}>
      {eyebrow ?
        <Text
          className="font-sans-md uppercase"
          style={{
            ...formTokens.typography.eyebrow,
            marginBottom: formTokens.spacing.eyebrowToTitle,
          }}>
          {eyebrow}
        </Text>
      : null}
      <Text
        className="font-sans-bold"
        style={{
          ...formTokens.typography.title,
          marginBottom: subtitle ? formTokens.spacing.titleToDescription : 0,
        }}>
        {title}
      </Text>
      {subtitle ?
        <Text className="font-sans" style={formTokens.typography.description}>
          {subtitle}
        </Text>
      : null}
    </View>
  );
}
