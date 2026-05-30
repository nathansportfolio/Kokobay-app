import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { REGISTER_PASSWORD_REQUIREMENTS } from '@/constants/auth-schemas';
import { formTokens } from '@/constants/form-tokens';
import { cn } from '@/utils/cn';

type PasswordRequirementsProps = {
  password: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function PasswordRequirements({ password, className, style }: PasswordRequirementsProps) {
  return (
    <View
      className={cn(className)}
      style={[{ gap: formTokens.passwordRequirements.gap }, style]}>
      {REGISTER_PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(password);
        return (
          <Text
            key={requirement.id}
            className="font-sans"
            style={{
              fontSize: formTokens.passwordRequirements.fontSize,
              lineHeight: formTokens.passwordRequirements.lineHeight,
              color:
                password.length > 0 && met ?
                  formTokens.passwordRequirements.metColor
                : formTokens.passwordRequirements.color,
            }}>
            {met && password.length > 0 ? '✓ ' : '○ '}
            {requirement.label}
          </Text>
        );
      })}
    </View>
  );
}
