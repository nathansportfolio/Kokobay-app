import { memo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

type Props = {
  /** Small caps label above the title; omit when the section is already introduced elsewhere (e.g. home hero). */
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

function HomeSectionTitleInner({ eyebrow, title, subtitle }: Props) {
  return (
    <View className="mb-6">
      {eyebrow ? (
        <Text variant="label" className="mb-2">
          {eyebrow}
        </Text>
      ) : null}
      <Text className="font-sans-semibold text-[26px] leading-8 tracking-[-0.45px] text-ink">{title}</Text>
      {subtitle ? (
        <Text variant="body" className="mt-3 max-w-[92%] text-[15px] leading-6">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export const HomeSectionTitle = memo(HomeSectionTitleInner);
