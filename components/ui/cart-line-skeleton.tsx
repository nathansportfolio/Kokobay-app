import { View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';

export function CartLineSkeleton() {
  return (
    <View className="mb-7 flex-row gap-5">
      <Skeleton className="h-[172px] w-[118px] rounded-3xl bg-warmElevated/80" />
      <View className="min-w-0 flex-1 justify-between pt-0.5">
        <View>
          <View className="mb-3 flex-row justify-between gap-3">
            <View className="min-w-0 flex-1 gap-2.5">
              <Skeleton className="h-5 w-[88%] rounded-md bg-warmElevated/90" />
              <Skeleton className="h-4 w-[55%] rounded-md bg-warmElevated/70" />
              <Skeleton className="h-3.5 w-24 rounded-md bg-warmElevated/60" />
            </View>
            <Skeleton className="h-10 w-10 rounded-full bg-warmElevated/70" />
          </View>
        </View>
        <View className="mt-8 flex-row items-center justify-between">
          <Skeleton className="h-11 w-[132px] rounded-full bg-warmElevated/80" />
          <Skeleton className="h-5 w-20 rounded-md bg-warmElevated/80" />
        </View>
      </View>
    </View>
  );
}
