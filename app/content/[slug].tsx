import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

/**
 * CMS / marketing page shell from push deep links (`/content/[slug]`).
 * Replace with a WebView or Koko Bay content API when available.
 */
export default function ContentDeepLinkScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const safeSlug = typeof slug === 'string' ? decodeURIComponent(slug) : '';

  return (
    <Screen scroll edges={['left', 'right']}>
      <Text variant="label" className="mb-2 text-accent">
        Content
      </Text>
      <Text variant="title" className="mb-4">
        {safeSlug || 'Page'}
      </Text>
      <Text variant="body" className="mb-8 text-mist">
        This page was opened from a notification. If the content is no longer available, return
        to the shop.
      </Text>
      <View className="gap-3">
        <Button title="Continue shopping" variant="primary" onPress={() => router.replace('/(tabs)')} />
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
