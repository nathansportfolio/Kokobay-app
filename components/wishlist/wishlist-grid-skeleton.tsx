import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  imageHeight: number;
  columns?: number;
  rows?: number;
};

/** 2-column grid skeleton — cell gutters align with `wishlist.tsx` FlashList grid */
export function WishlistGridSkeleton({ imageHeight, columns = 2, rows = 2 }: Props) {
  const cells = Array.from({ length: columns * rows }, (_, i) => i);
  return (
    <View className="flex-row flex-wrap">
      {cells.map((i) => (
        <View key={i} style={{ width: '50%', paddingHorizontal: 5, marginBottom: 20 }}>
          <Skeleton className="w-full rounded-2xl bg-warmElevated/85" style={{ height: imageHeight }} />
          <Skeleton className="mt-2.5 h-3.5 w-[92%] rounded-sm bg-warmElevated/75" />
          <Skeleton className="mt-1.5 h-3 w-14 rounded-sm bg-warmElevated/65" />
        </View>
      ))}
    </View>
  );
}
