import { Redirect, useLocalSearchParams } from 'expo-router';

/** Push / universal link entry — forwards to the tabbed collection PLP. */
export default function CollectionDeepLinkScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const safe = typeof handle === 'string' ? decodeURIComponent(handle) : '';

  if (!safe) {
    return <Redirect href="/(tabs)/categories" />;
  }

  return <Redirect href={`/collection/${safe}`} />;
}
