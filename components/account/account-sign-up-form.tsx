import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState, type MutableRefObject } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { TextInput, View } from 'react-native';

import { AccountAuthBackButton } from '@/components/account/account-auth-back-button';
import { AccountLegalLinks } from '@/components/account/account-legal-links';
import { AuthFormHeader } from '@/components/forms/auth-form-header';
import { ErrorMessage } from '@/components/forms/error-message';
import { LoadingButton } from '@/components/forms/loading-button';
import { PasswordInput } from '@/components/forms/password-input';
import { PasswordRequirements } from '@/components/forms/password-requirements';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { FormInput } from '@/components/ui/form-input';
import { registerSchema, type RegisterFormValues } from '@/constants/auth-schemas';
import { formTokens } from '@/constants/form-tokens';
import { useClearAuthErrors } from '@/hooks/use-clear-auth-errors';
import { useAuthStore } from '@/store';
import {
  mapFieldErrorMessage,
  resolveAuthErrorCard,
  type AuthErrorCard,
} from '@/utils/auth-error-messages';

type AccountSignUpFormProps = {
  canGoBack: boolean;
  onBack: () => void;
  onSignIn: () => void;
};

export function AccountSignUpForm({ canGoBack, onBack, onSignIn }: AccountSignUpFormProps) {
  const register = useAuthStore((s) => s.register);
  const [serverError, setServerError] = useState<AuthErrorCard | null>(null);

  const {
    control,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const { bindTextChange } = useClearAuthErrors(clearErrors);
  const password = useWatch({ control, name: 'password' }) ?? '';

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const clearServerError = () => setServerError(null);

  const mergeInputRef =
    (fieldRef: (instance: TextInput | null) => void, stash?: MutableRefObject<TextInput | null>) =>
    (instance: TextInput | null) => {
      fieldRef(instance);
      if (stash) stash.current = instance;
    };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await register({
      email: values.email.trim(),
      password: values.password,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
    });
    if (!result.ok) {
      setServerError(resolveAuthErrorCard(result.error, 'register', result.code));
    }
  });

  return (
    <>
      {canGoBack ?
        <AccountAuthBackButton label="Account" onPress={onBack} />
      : null}

      <AuthFormHeader
        eyebrow="Join"
        title="Create account"
        subtitle="A few details to open your Koko Bay account."
      />

      <ErrorMessage
        title={serverError?.title ?? ''}
        message={serverError?.message}
        visible={Boolean(serverError)}
      />

      <View className="flex-row gap-3" style={{ marginBottom: formTokens.spacing.fieldGap }}>
        <FormField
          label="First name"
          error={mapFieldErrorMessage('firstName', errors.firstName?.message)}
          marginBottom={0}
          className="flex-1">
          <Controller
            control={control}
            name="firstName"
            render={({ field: { ref, onChange, onBlur, value } }) => (
              <FormInput
                ref={ref}
                autoCapitalize="words"
                textContentType="givenName"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => lastNameRef.current?.focus()}
                onBlur={onBlur}
                onChangeText={bindTextChange('firstName', (text) => {
                  clearServerError();
                  onChange(text);
                })}
                value={value}
                placeholder="Sofia"
              />
            )}
          />
        </FormField>
        <FormField
          label="Last name"
          error={mapFieldErrorMessage('lastName', errors.lastName?.message)}
          marginBottom={0}
          className="flex-1">
          <Controller
            control={control}
            name="lastName"
            render={({ field: { ref, onChange, onBlur, value } }) => (
              <FormInput
                ref={mergeInputRef(ref, lastNameRef)}
                autoCapitalize="words"
                textContentType="familyName"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
                onBlur={onBlur}
                onChangeText={bindTextChange('lastName', (text) => {
                  clearServerError();
                  onChange(text);
                })}
                value={value}
                placeholder="Renard"
              />
            )}
          />
        </FormField>
      </View>

      <FormField label="Email" error={mapFieldErrorMessage('email', errors.email?.message)}>
        <Controller
          control={control}
          name="email"
          render={({ field: { ref, onChange, onBlur, value } }) => (
            <FormInput
              ref={mergeInputRef(ref, emailRef)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              onBlur={onBlur}
              onChangeText={bindTextChange('email', (text) => {
                clearServerError();
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
        marginBottom={formTokens.spacing.fieldGap}>
        <Controller
          control={control}
          name="password"
          render={({ field: { ref, onChange, onBlur, value } }) => (
            <PasswordInput
              ref={mergeInputRef(ref, passwordRef)}
              textContentType="newPassword"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              onBlur={onBlur}
              onChangeText={bindTextChange('password', (text) => {
                clearServerError();
                onChange(text);
              })}
              value={value}
              placeholder="Create a password"
            />
          )}
        />
        <PasswordRequirements
          password={password}
          style={{ marginTop: formTokens.spacing.labelToInput }}
        />
      </FormField>

      <FormField
        label="Confirm password"
        error={mapFieldErrorMessage('confirmPassword', errors.confirmPassword?.message)}
        marginBottom={formTokens.spacing.ctaTop}>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { ref, onChange, onBlur, value } }) => (
            <PasswordInput
              ref={mergeInputRef(ref, confirmPasswordRef)}
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={() => void onSubmit()}
              onBlur={onBlur}
              onChangeText={bindTextChange('confirmPassword', (text) => {
                clearServerError();
                onChange(text);
              })}
              value={value}
              placeholder="Re-enter your password"
            />
          )}
        />
      </FormField>

      <View style={{ gap: formTokens.spacing.buttonGap }}>
        <LoadingButton
          title="Create account"
          loadingTitle="Creating account..."
          variant="primary"
          size="form"
          loading={isSubmitting}
          onPress={onSubmit}
        />
        <Button title="Back to sign in" variant="secondary" size="form" onPress={onSignIn} />
      </View>
      <View className="mt-8">
        <AccountLegalLinks />
      </View>
    </>
  );
}
