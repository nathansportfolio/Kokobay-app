import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { hapticSelection } from '@/utils/haptics';
import type { PlpSort } from '@/types/plp';
import { PLP_SORT_OPTIONS } from '@/types/plp';
import { cn } from '@/utils/cn';

export type CollectionPlpSortModalProps = {
  visible: boolean;
  onClose: () => void;
  sort: PlpSort;
  onSelect: (sort: PlpSort) => void;
};

export function CollectionPlpSortModal({ visible, onClose, sort, onSelect }: CollectionPlpSortModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/45" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-warmCanvas px-5 pt-5"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
          onPress={(e) => e.stopPropagation()}>
          <View className="mb-5 h-1 w-9 self-center rounded-full bg-line/80" />
          <Text variant="title" className="mb-5 text-[17px] tracking-[-0.2px] text-ink">
            Sort by
          </Text>
          {PLP_SORT_OPTIONS.map((opt) => {
            const selected = sort === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  hapticSelection();
                  onSelect(opt.value);
                  onClose();
                }}
                className={cn(
                  'mb-2.5 rounded-2xl border px-4 py-3.5 active:opacity-88',
                  selected ? 'border-accent/75 bg-accent/10' : 'border-line/55 bg-warmSurface/80',
                )}>
                <Text variant="body" className={cn('text-[15px]', selected ? 'font-sans-md text-accent' : 'text-ink')}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
