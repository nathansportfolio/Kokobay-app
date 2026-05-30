import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { AccountAuthBackButton } from '@/components/account/account-auth-back-button';
import { AuthFormHeader } from '@/components/forms/auth-form-header';
import { ErrorMessage } from '@/components/forms/error-message';
import { LoadingButton } from '@/components/forms/loading-button';
import { PasswordInput } from '@/components/forms/password-input';
import { AppSettingsLink } from '@/components/settings/app-settings-link';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { FormInput } from '@/components/ui/form-input';
import { Text } from '@/components/ui/text';
import { loginSchema, type LoginFormValues } from '@/constants/auth-schemas';
import { formTokens } from '@/constants/form-tokens';
import { useClearAuthErrors } from '@/hooks/use-clear-auth-errors';
import { useAuthStore } from '@/store';
import { isAllowedCheckoutUrl } from '@/utils/checkout-url';
import {
  mapFieldErrorMessage,
  resolveAuthErrorCard,
  type AuthErrorCard,
} from '@/utils/auth-error-messages';

type AccountSignInFormProps = {
  canGoBack: boolean;
  returnTo?: string | null;
  onBack: () => void;
  onCheckoutBack?: (checkoutUrl: string) => void;
  onSuccess: () => void;
  onForgotPassword: () => void;
  onCreateAccount: () => void;
  onOpenSettings: () => void;
};

export function AccountSignInForm({
  canGoBack,
  returnTo,
  onBack,
  onCheckoutBack,
  onSuccess,
  onForgotPassword,
  onCreateAccount,
  onOpenSettings,
}: AccountSignInFormProps) {
  const login = useAuthStore((s) => s.login);
  const [serverError, setServerError] = useState<AuthErrorCard | null>(null);

  const {
    control,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { bindTextChange } = useClearAuthErrors(clearErrors);

  const resumeCheckout = useMemo(() => {
    const raw = returnTo?.trim() ?? '';
    return raw && isAllowedCheckoutUrl(raw) ? raw : null;
  }, [returnTo]);

  const backLabel = resumeCheckout ? 'Back to checkout' : 'Account';

  const handleBack = () => {
    if (resumeCheckout && onCheckoutBack) {
      onCheckoutBack(resumeCheckout);
      return;
    }
    onBack();
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await login(values.email.trim(), values.password);
    if (!result.ok) {
      setServerError(resolveAuthErrorCard(result.error, 'login', result.code));
      return;
    }
    onSuccess();
  });

  return (
    <>
      {canGoBack || resumeCheckout ?
        <AccountAuthBackButton label={backLabel} onPress={handleBack} />
      : null}

      <AuthFormHeader
        eyebrow={resumeCheckout ? 'Checkout' : 'Welcome back'}
        title="Sign in"
        subtitle={
          resumeCheckout ?
            'Sign in to continue checkout with your saved details.'
          : 'Sign in with your Koko Bay account.'
        }
      />

      <ErrorMessage
        title={serverError?.title ?? ''}
        message={serverError?.message}
        visible={Boolean(serverError)}
      />

      <FormField label="Email" error={mapFieldErrorMessage('email', errors.email?.message)}>
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

      <FormField
        label="Password"
        error={mapFieldErrorMessage('password', errors.password?.message)}
        marginBottom={formTokens.spacing.ctaTop}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordInput
              onBlur={onBlur}
              onChangeText={bindTextChange('password', (text) => {
                setServerError(null);
                onChange(text);
              })}
              value={value}
              placeholder="Enter your password"
            />
          )}
        />
        <View className="items-end" style={{ marginTop: formTokens.spacing.forgotPasswordTop }}>
          <Pressable onPress={onForgotPassword} hitSlop={8}>
            <Text className="font-sans" style={formTokens.typography.link}>
              Forgot password?
            </Text>
          </Pressable>
        </View>
      </FormField>

      <View style={{ gap: formTokens.spacing.buttonGap }}>
        <LoadingButton
          title="Continue"
          loadingTitle="Signing in..."
          variant="primary"
          size="form"
          loading={isSubmitting}
          onPress={onSubmit}
        />
        <Button title="Create an account" variant="secondary" size="form" onPress={onCreateAccount} />
      </View>
      <AppSettingsLink onPress={onOpenSettings} />
    </>
  );
}
