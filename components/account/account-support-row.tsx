import { Mail } from 'lucide-react-native';
import { Linking } from 'react-native';

import { AccountCard } from '@/components/account/account-layout';
import { AccountSettingsRow } from '@/components/account/account-settings-row';
import { palette } from '@/constants/theme';
import { hapticLight } from '@/utils/haptics';

const SUPPORT_EMAIL = 'info@kokobay.co.uk';

export function AccountSupportRow() {
  const openMail = () => {
    hapticLight();
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Koko Bay app support')}`;
    void Linking.openURL(url).catch(() => {});
  };

  return (
    <AccountCard>
      <AccountSettingsRow
        label="Email support"
        description={SUPPORT_EMAIL}
        onPress={openMail}
        accessibilityLabel={`Email support at ${SUPPORT_EMAIL}`}
        trailing={<Mail size={18} color={palette.mist} strokeWidth={1.5} />}
      />
    </AccountCard>
  );
}
