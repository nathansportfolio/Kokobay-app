import { useWindowDimensions, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

const CARD_COUNT = 4;

export function PdpRelatedProductsSkeleton() {
  const { width } = useWindowDimensions();
  const itemW = Math.min(200, Math.round(width * 0.42));
  const imageH = Math.ceil(itemW * (4 / 3));

  return (
    <View className="mb-14 mt-12 border-t border-black/[0.06] pt-12">
      <Skeleton className="mb-6 h-3 w-36 rounded-sm" />
      <View className="flex-row">
        {Array.from({ length: CARD_COUNT }).map((_, i) => (
          <View key={i} style={{ width: itemW }} className="mr-4">
            <Skeleton className="rounded-none" style={{ width: itemW, height: imageH }} />
            <Skeleton className="mt-2 h-3 w-[78%] rounded-sm" />
            <Skeleton className="mt-2 h-3 w-[48%] rounded-sm" />
          </View>
        ))}
      </View>
    </View>
  );
}
