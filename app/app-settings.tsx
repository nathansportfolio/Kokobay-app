import { Redirect } from 'expo-router';

import { accountSettingsRoute } from '@/utils/account-navigation';

export default function AppSettingsRedirect() {
  return <Redirect href={accountSettingsRoute()} />;
}
