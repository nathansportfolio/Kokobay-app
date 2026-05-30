import { View } from 'react-native';

import { AccountOrdersSection } from '@/components/account/account-orders-section';
import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { AppSettingsLink } from '@/components/settings/app-settings-link';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formTokens } from '@/constants/form-tokens';
import type { AuthUser } from '@/types/auth';

type AccountDashboardProps = {
  user: AuthUser;
  accessToken: string | null;
  openOrderId?: string;
  openOrderNumber?: string;
  isLoggingOut: boolean;
  onLogout: () => void;
  onRequestSignIn: () => void;
  onOpenSettings: () => void;
};

export function AccountDashboard({
  user,
  accessToken,
  openOrderId,
  openOrderNumber,
  isLoggingOut,
  onLogout,
  onRequestSignIn,
  onOpenSettings,
}: AccountDashboardProps) {
  const displayName = `${user.firstName} ${user.lastName}`.trim() || user.email;

  return (
    <>
      <LuxuryTabScreenHeader title="Account" />

      <View
        className="border border-formBorder bg-formBg px-5 py-6"
        style={{
          borderRadius: formTokens.input.borderRadius,
          marginBottom: formTokens.spacing.sectionGap,
        }}>
        <Text
          className="mb-4 font-sans-md uppercase"
          style={{
            fontSize: formTokens.label.fontSize,
            letterSpacing: formTokens.label.letterSpacing,
            fontWeight: formTokens.label.fontWeight,
            color: formTokens.label.color,
          }}>
          Profile
        </Text>
        <Text variant="body" className="text-ink">
          {displayName}
        </Text>
        <Text variant="caption" className="mt-1.5 font-sans text-[14px] leading-5 text-mist/90">
          {user.email}
        </Text>
      </View>

      <View
        className="border border-formBorder bg-formBg px-5 py-6"
        style={{
          borderRadius: formTokens.input.borderRadius,
          marginBottom: formTokens.spacing.sectionGap,
        }}>
        <Text
          className="mb-4 font-sans-md uppercase"
          style={{
            fontSize: formTokens.label.fontSize,
            letterSpacing: formTokens.label.letterSpacing,
            fontWeight: formTokens.label.fontWeight,
            color: formTokens.label.color,
          }}>
          Orders
        </Text>
        <AccountOrdersSection
          sessionToken={accessToken}
          openOrderId={openOrderId}
          openOrderNumber={openOrderNumber}
          onRequestSignIn={onRequestSignIn}
        />
      </View>

      <View
        className="border border-formBorder bg-formBg px-5 py-6"
        style={{
          borderRadius: formTokens.input.borderRadius,
          marginBottom: formTokens.spacing.sectionGap,
        }}>
        <Text variant="body" className="text-mist">
          For support, please email info@kokobay.co.uk
        </Text>
      </View>

      <Button
        title={isLoggingOut ? 'Signing out…' : 'Sign out'}
        variant="secondary"
        size="form"
        loading={isLoggingOut}
        disabled={isLoggingOut}
        onPress={onLogout}
      />
      <AppSettingsLink className="mt-6" onPress={onOpenSettings} />
    </>
  );
}
