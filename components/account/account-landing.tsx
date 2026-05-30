import { View } from 'react-native';

import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { AppSettingsLink } from '@/components/settings/app-settings-link';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';

type AccountLandingProps = {
  onSignIn: () => void;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
  onOpenSettings: () => void;
};

export function AccountLanding({
  onSignIn,
  onCreateAccount,
  onForgotPassword,
  onOpenSettings,
}: AccountLandingProps) {
  return (
    <>
      <LuxuryTabScreenHeader title="Account" />
      <Text className="mb-6 font-sans text-[14px] leading-[21px] text-mist/90">
        Sign in to view orders, saved addresses, and preferences. Your session is stored securely on
        this device.
      </Text>
      <View style={{ gap: formTokens.spacing.buttonGap }}>
        <Button title="Sign in" variant="primary" size="form" onPress={onSignIn} />
        <Button title="Create account" variant="secondary" size="form" onPress={onCreateAccount} />
        <Button title="Forgot password" variant="ghost" size="form" onPress={onForgotPassword} />
      </View>
      <AppSettingsLink onPress={onOpenSettings} />
    </>
  );
}
