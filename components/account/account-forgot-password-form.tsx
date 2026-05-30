import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { AccountAuthBackButton } from '@/components/account/account-auth-back-button';
import { AuthFormHeader } from '@/components/forms/auth-form-header';
import { ErrorMessage } from '@/components/forms/error-message';
import { LoadingButton } from '@/components/forms/loading-button';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { FormInput } from '@/components/ui/form-input';
import { Text } from '@/components/ui/text';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/constants/auth-schemas';
import { formTokens } from '@/constants/form-tokens';
import { useClearAuthErrors } from '@/hooks/use-clear-auth-errors';
import { useAuthStore } from '@/store';
import {
  mapFieldErrorMessage,
  resolveAuthErrorCard,
  type AuthErrorCard,
} from '@/utils/auth-error-messages';

type AccountForgotPasswordFormProps = {
  canGoBack: boolean;
  onBack: () => void;
  onSignIn: () => void;
};

export function AccountForgotPasswordForm({ canGoBack, onBack, onSignIn }: AccountForgotPasswordFormProps) {
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const [serverError, setServerError] = useState<AuthErrorCard | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const { bindTextChange } = useClearAuthErrors(clearErrors);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setDoneMessage(null);
    const result = await requestPasswordReset(values.email.trim());
    if (!result.ok) {
      setServerError(resolveAuthErrorCard(result.error, 'forgot', result.code));
      return;
    }
    setDoneMessage(result.message);
    reset({ email: '' });
  });

  return (
    <>
      {canGoBack ?
        <AccountAuthBackButton label="Back" onPress={onBack} />
      : null}

      <AuthFormHeader
        eyebrow="Account"
        title="Forgot password"
        subtitle="Enter the email you used at checkout or registration. For privacy we always show the same confirmation message."
      />

      {doneMessage ?
        <Animated.View
          entering={FadeInDown.duration(formTokens.error.animationMs)}
          exiting={FadeOutUp.duration(formTokens.error.animationMs - 30)}
          style={{ marginBottom: formTokens.spacing.errorToForm }}>
          <View
            className="border border-formBorder bg-formBg"
            style={{
              borderRadius: formTokens.error.borderRadius,
              paddingHorizontal: formTokens.error.paddingHorizontal,
              paddingVertical: formTokens.error.paddingVertical,
            }}>
            <Text className="font-sans" style={formTokens.typography.description}>
              {doneMessage}
            </Text>
          </View>
        </Animated.View>
      : null}

      <ErrorMessage
        title={serverError?.title ?? ''}
        message={serverError?.message}
        visible={Boolean(serverError)}
      />

      <FormField
        label="Email"
        error={mapFieldErrorMessage('email', errors.email?.message)}
        marginBottom={formTokens.spacing.ctaTop}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={bindTextChange('email', (text) => {
                setServerError(null);
                onChange(text);
              })}
              value={value}
              placeholder="you@example.com"
            />
          )}
        />
      </FormField>

      <View style={{ gap: formTokens.spacing.buttonGap }}>
        <LoadingButton
          title="Send reset link"
          loadingTitle="Sending..."
          variant="primary"
          size="form"
          loading={isSubmitting}
          onPress={onSubmit}
        />
        <Button title="Back to sign in" variant="secondary" size="form" onPress={onSignIn} />
      </View>
    </>
  );
}
