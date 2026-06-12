import { Redirect, useLocalSearchParams } from 'expo-router';

import { accountAuthRoute } from '@/utils/account-navigation';

export default function LoginRedirect() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const raw = typeof returnTo === 'string' ? returnTo.trim() : undefined;

  return (
    <Redirect
      href={accountAuthRoute({
        mode: 'signin',
        ...(raw ? { returnTo: raw } : {}),
      })}
    />
  );
}
