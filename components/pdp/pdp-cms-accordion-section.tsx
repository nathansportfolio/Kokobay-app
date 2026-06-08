import { Linking, Pressable, View } from 'react-native';

import { PdpAccordion } from '@/components/pdp/pdp-accordion';
import { RichTextRenderer } from '@/components/cms/rich-text-renderer';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { appContentHasBody, useAppContent } from '@/hooks/use-app-content';
import { hapticLight } from '@/utils/haptics';

type Props = {
  slug: string;
  fallbackTitle: string;
  fallbackContent?: string;
  countryCode?: string;
  /** Slug already includes market (e.g. `shipping-info-gb`) — skip `?country=` on the API. */
  omitCountry?: boolean;
  footerLink?: { label: string; url: string };
};

function AccordionBodySkeleton() {
  return (
    <View className="gap-2.5">
      <Skeleton className="h-4 w-full rounded-sm" />
      <Skeleton className="h-4 w-[94%] rounded-sm" />
      <Skeleton className="h-4 w-[82%] rounded-sm" />
    </View>
  );
}

function AccordionFooterLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        void Linking.openURL(url).catch(() => {});
      }}
      accessibilityRole="link"
      accessibilityLabel={`${label}, opens in browser`}
      className="mt-4 self-start active:opacity-75">
      <Text className="text-[15px] leading-7 text-accent underline">{label}</Text>
    </Pressable>
  );
}

export function PdpCmsAccordionSection({
  slug,
  fallbackTitle,
  fallbackContent,
  countryCode,
  omitCountry,
  footerLink,
}: Props) {
  const cms = useAppContent(slug, countryCode, { omitCountry });

  const useFallback = !cms.loading && !appContentHasBody(cms) && Boolean(fallbackContent?.trim());

  if (!cms.loading && !appContentHasBody(cms) && !useFallback) {
    return null;
  }

  const title = cms.title || fallbackTitle;

  return (
    <PdpAccordion title={title}>
      {cms.loading ? (
        <AccordionBodySkeleton />
      ) : useFallback ? (
        <>
          <Text variant="body" className="text-[15px] leading-7 text-muted">
            {fallbackContent}
          </Text>
          {footerLink ? (
            <AccordionFooterLink label={footerLink.label} url={footerLink.url} />
          ) : null}
        </>
      ) : (
        <>
          <RichTextRenderer richContent={cms.richContent} plainText={cms.content} />
          {footerLink ? (
            <AccordionFooterLink label={footerLink.label} url={footerLink.url} />
          ) : null}
        </>
      )}
    </PdpAccordion>
  );
}
