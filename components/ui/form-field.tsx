import { createContext, useContext, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { FieldError } from '@/components/forms/field-error';
import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';
import { cn } from '@/utils/cn';

type FormFieldFocusContextValue = (focused: boolean) => void;

const FormFieldFocusContext = createContext<FormFieldFocusContextValue | null>(null);
const FormFieldErrorContext = createContext(false);

export function useFormFieldFocus(onFocusChange?: (focused: boolean) => void) {
  const setFieldFocused = useContext(FormFieldFocusContext);

  return (focused: boolean) => {
    setFieldFocused?.(focused);
    onFocusChange?.(focused);
  };
}

export function useFormFieldError() {
  return useContext(FormFieldErrorContext);
}

export type FormFieldProps = {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  marginBottom?: number;
  children: ReactNode;
};

export function FormField({
  label,
  error,
  hint,
  className,
  marginBottom = formTokens.spacing.fieldGap,
  children,
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <FormFieldFocusContext.Provider value={setFocused}>
      <FormFieldErrorContext.Provider value={hasError}>
        <View className={cn(className)} style={{ marginBottom }}>
          <Text
            className="font-sans-md uppercase"
            style={{
              fontSize: formTokens.label.fontSize,
              letterSpacing: formTokens.label.letterSpacing,
              fontWeight: formTokens.label.fontWeight,
              color: focused ? formTokens.label.focused : formTokens.label.color,
              marginBottom: formTokens.spacing.labelToInput,
            }}>
            {label}
          </Text>
          {children}
          {hint && !error ?
            <Text
              className="font-sans"
              style={{
                marginTop: 8,
                fontSize: formTokens.passwordRequirements.fontSize,
                color: formTokens.passwordRequirements.color,
              }}>
              {hint}
            </Text>
          : null}
          <FieldError message={error} />
        </View>
      </FormFieldErrorContext.Provider>
    </FormFieldFocusContext.Provider>
  );
}
