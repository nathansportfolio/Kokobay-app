import { PdpAccordion } from '@/components/pdp/pdp-accordion';
import { RichTextRenderer } from '@/components/cms/rich-text-renderer';
import { Skeleton } from '@/components/ui/skeleton';
import { appContentHasBody, useAppContent } from '@/hooks/use-app-content';
import { View } from 'react-native';

type Props = {
  slug: string;
  fallbackTitle: string;
  countryCode?: string;
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

export function PdpCmsAccordionSection({ slug, fallbackTitle, countryCode }: Props) {
  const cms = useAppContent(slug, countryCode);

  if (!cms.loading && !appContentHasBody(cms)) {
    return null;
  }

  const title = cms.title || fallbackTitle;

  return (
    <PdpAccordion title={title}>
      {cms.loading ? (
        <AccordionBodySkeleton />
      ) : (
        <RichTextRenderer richContent={cms.richContent} plainText={cms.content} />
      )}
    </PdpAccordion>
  );
}
