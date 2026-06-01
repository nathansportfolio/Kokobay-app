import { View } from 'react-native';

import { AccountDeleteAccountSection } from '@/components/account/account-delete-account-section';
import {
  ACCOUNT_SCREEN_GAP,
  AccountCard,
  AccountSection,
} from '@/components/account/account-layout';
import { AccountOrdersSection } from '@/components/account/account-orders-section';
import { AccountPreferencesPanel } from '@/components/account/account-preferences-panel';
import { AccountProfileCard } from '@/components/account/account-profile-card';
import { AccountLegalLinks } from '@/components/account/account-legal-links';
import { AccountSupportRow } from '@/components/account/account-support-row';
import { LuxuryTabScreenHeader } from '@/components/navigation/luxury-tab-screen-header';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/types/auth';

type AccountDashboardProps = {
  user: AuthUser;
  accessToken: string | null;
  openOrderId?: string;
  openOrderNumber?: string;
  isLoggingOut: boolean;
  onLogout: () => void;
  onAccountDeletionRequested: () => void | Promise<void>;
  onRequestSignIn: () => void;
  onRegisterRefresh?: (refresh: (() => Promise<void>) | null) => void;
};

export function AccountDashboard({
  user,
  accessToken,
  openOrderId,
  openOrderNumber,
  isLoggingOut,
  onLogout,
  onAccountDeletionRequested,
  onRequestSignIn,
  onRegisterRefresh,
}: AccountDashboardProps) {
  return (
    <>
      <LuxuryTabScreenHeader title="Account" />

      <View style={{ gap: ACCOUNT_SCREEN_GAP }}>
        <AccountSection title="Profile">
          <AccountProfileCard user={user} />
        </AccountSection>

        <AccountSection title="Orders">
          <AccountCard>
            <View className="px-4 py-1">
              <AccountOrdersSection
                sessionToken={accessToken}
                openOrderId={openOrderId}
                openOrderNumber={openOrderNumber}
                onRequestSignIn={onRequestSignIn}
                embedded
              />
            </View>
          </AccountCard>
        </AccountSection>

        <AccountSection title="Preferences">
          <AccountCard>
            <AccountPreferencesPanel onRegisterRefresh={onRegisterRefresh} />
          </AccountCard>
        </AccountSection>

        <AccountSection title="Support">
          <AccountSupportRow />
        </AccountSection>

        <AccountSection title="Legal">
          <AccountLegalLinks />
        </AccountSection>

        <View className="gap-3 pt-1">
          <Button
            title={isLoggingOut ? 'Signing out…' : 'Sign out'}
            variant="secondary"
            loading={isLoggingOut}
            disabled={isLoggingOut}
            onPress={onLogout}
          />
        </View>

        <AccountDeleteAccountSection
          sessionToken={accessToken}
          onDeletionRequested={onAccountDeletionRequested}
        />
      </View>
    </>
  );
}
