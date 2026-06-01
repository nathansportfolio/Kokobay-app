import { Redirect, useLocalSearchParams } from 'expo-router';

/** Store promotional / CMS pages — `/pages/[slug]` → in-app content shell. */
export default function StorePageDeepLinkScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const safe = typeof slug === 'string' ? decodeURIComponent(slug) : '';

  if (!safe) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href={`/content/${safe}`} />;
}
