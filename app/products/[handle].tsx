import { Redirect, useLocalSearchParams } from 'expo-router';

/** Push / universal link entry — forwards to the tabbed product screen. */
export default function ProductDeepLinkScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const safe = typeof handle === 'string' ? decodeURIComponent(handle) : '';

  if (!safe) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href={`/product/${safe}`} />;
}
