import { Redirect } from 'expo-router';

import { accountAuthRoute } from '@/utils/account-navigation';

export default function ForgotPasswordRedirect() {
  return <Redirect href={accountAuthRoute({ mode: 'forgotPassword' })} />;
}
