import { ChevronRight } from 'lucide-react-native';
import { Linking } from 'react-native';

import { AccountCard } from '@/components/account/account-layout';
import { AccountSettingsRow } from '@/components/account/account-settings-row';
import { palette } from '@/constants/theme';
import { hapticLight } from '@/utils/haptics';

export const TERMS_AND_CONDITIONS_URL =
  'https://www.kokobay.co.uk/pages/terms-conditions';
export const PRIVACY_POLICY_URL = 'https://www.kokobay.co.uk/pages/privacy-policy';

function openLegalUrl(url: string) {
  hapticLight();
  void Linking.openURL(url).catch(() => {});
}

const chevron = <ChevronRight size={18} color={palette.mist} strokeWidth={1.5} />;

export function AccountLegalLinks() {
  return (
    <AccountCard>
      <AccountSettingsRow
        label="Terms & conditions"
        onPress={() => openLegalUrl(TERMS_AND_CONDITIONS_URL)}
        showDivider
        accessibilityLabel="Terms and conditions, opens in browser"
        trailing={chevron}
      />
      <AccountSettingsRow
        label="Privacy policy"
        onPress={() => openLegalUrl(PRIVACY_POLICY_URL)}
        accessibilityLabel="Privacy policy, opens in browser"
        trailing={chevron}
      />
    </AccountCard>
  );
}
