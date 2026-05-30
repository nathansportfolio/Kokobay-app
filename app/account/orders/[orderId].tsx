import { Redirect, useLocalSearchParams } from 'expo-router';

/** Push entry for order updates — opens Account with order preview. */
export default function OrderDeepLinkScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const safe = typeof orderId === 'string' ? decodeURIComponent(orderId) : '';

  if (!safe) {
    return <Redirect href="/(tabs)/account" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/account',
        params: { orderId: safe },
      }}
    />
  );
}
