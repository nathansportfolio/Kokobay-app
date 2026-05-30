import { Redirect } from 'expo-router';

import { accountAuthRoute } from '@/utils/account-navigation';

export default function RegisterRedirect() {
  return <Redirect href={accountAuthRoute({ mode: 'signup' })} />;
}
