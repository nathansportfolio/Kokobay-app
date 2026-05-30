import { View } from 'react-native';

import { RichTextRenderer } from '@/components/cms/rich-text-renderer';
import { Text } from '@/components/ui/text';
import { useAppErrorBannerContent } from '@/hooks/use-app-error-banner-content';

/** Incident strip rendered below navigation headers (no status-bar inset). */
export function AppErrorBannerStrip() {
  const { visible, loading, title, content, richContent } = useAppErrorBannerContent();

  if (!visible) {
    if (__DEV__) {
      console.log('[AppErrorBanner] strip hidden', { visible, loading, title: title || '(empty)' });
    }
    return null;
  }

  if (__DEV__) {
    console.log('[AppErrorBanner] strip rendering', { title: title || '(empty)' });
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: '#6E5E4F',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(20, 20, 20, 0.12)',
      }}>
      <View className="px-4 py-3">
        {title ? (
          <Text className="mb-1.5 font-sans-md text-[10px] uppercase tracking-[0.22em] text-canvas/85">
            {title}
          </Text>
        ) : null}
        <RichTextRenderer richContent={richContent} plainText={content} tone="inverse" />
      </View>
    </View>
  );
}
