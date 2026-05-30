import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useCallback, useState, type ElementRef } from 'react';
import { Pressable, View } from 'react-native';

import { FormInput, type FormInputProps } from '@/components/ui/form-input';
import { formTokens } from '@/constants/form-tokens';
import { hapticLight } from '@/utils/haptics';

export type PasswordInputProps = Omit<FormInputProps, 'secure' | 'secureTextEntry'>;

export const PasswordInput = forwardRef<ElementRef<typeof FormInput>, PasswordInputProps>(
  ({ onFocusChange, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);

    const toggleVisibility = useCallback(() => {
      hapticLight();
      setVisible((current) => !current);
    }, []);

    return (
      <View className="relative">
        <FormInput
          ref={ref}
          secure
          secureTextEntry={!visible}
          onFocusChange={onFocusChange}
          style={{ paddingRight: formTokens.input.paddingHorizontal + 28 }}
          {...rest}
        />
        <Pressable
          onPress={toggleVisibility}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={10}
          className="absolute bottom-0 right-0 top-0 items-center justify-center"
          style={{ width: formTokens.input.paddingHorizontal + 28 }}>
          {visible ?
            <EyeOff size={20} color={formTokens.input.placeholder} strokeWidth={1.75} />
          : <Eye size={20} color={formTokens.input.placeholder} strokeWidth={1.75} />}
        </Pressable>
      </View>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
