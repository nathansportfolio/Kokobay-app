import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PdpLightboxZoomSlide } from '@/components/pdp/pdp-lightbox-zoom-slide';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type PdpImageLightboxProps = {
  visible: boolean;
  uris: string[];
  initialIndex: number;
  onClose: () => void;
};

const VIEWABILITY = { itemVisiblePercentThreshold: 55 } as const;

export function PdpImageLightbox({ visible, uris, initialIndex, onClose }: PdpImageLightboxProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<string>>(null);
  const safeIndex = uris.length ? Math.min(Math.max(0, initialIndex), uris.length - 1) : 0;
  const [visibleIndex, setVisibleIndex] = useState(safeIndex);
  const [zoomPagerLocked, setZoomPagerLocked] = useState(false);

  useEffect(() => {
    if (visible) setVisibleIndex(safeIndex);
  }, [visible, safeIndex]);

  useEffect(() => {
    if (!visible) setZoomPagerLocked(false);
  }, [visible]);

  const onZoomLockChange = useCallback((locked: boolean) => {
    setZoomPagerLocked(locked);
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      const i = viewableItems[0]?.index;
      if (typeof i === 'number') setVisibleIndex(i);
    },
    [],
  );

  useEffect(() => {
    if (!visible || !uris.length) return;
    const id = requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index: safeIndex, animated: false });
      } catch {
        listRef.current?.scrollToOffset({ offset: safeIndex * width, animated: false });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [visible, safeIndex, uris.length, width]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  const renderItem: ListRenderItem<string> = useCallback(
    ({ item, index }) => (
      <PdpLightboxZoomSlide
        uri={item}
        width={width}
        height={height}
        isActive={visible && index === visibleIndex}
        onZoomLockChange={onZoomLockChange}
      />
    ),
    [width, height, visibleIndex, onZoomLockChange],
  );

  const keyExtractor = useCallback((item: string, index: number) => `${index}:${item}`, []);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const offset = info.index * info.averageItemLength;
      listRef.current?.scrollToOffset({ offset, animated: false });
    },
    [],
  );

  if (!uris.length || !visible) {
    return null;
  }

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" hidden={visible} />
      <View className="flex-1 bg-black">
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={uris}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomPagerLocked}
          showsHorizontalScrollIndicator={false}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialScrollIndex={safeIndex}
          initialNumToRender={Math.min(uris.length, 5)}
          maxToRenderPerBatch={4}
          windowSize={5}
          onScrollToIndexFailed={onScrollToIndexFailed}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY}
          keyboardShouldPersistTaps="handled"
        />

        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top + 8,
            paddingHorizontal: 12,
            flexDirection: 'row',
            justifyContent: 'flex-end',
            zIndex: 20,
          }}>
          <Pressable
            onPress={onClose}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close full screen images"
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: 'rgba(255,255,255,0.28)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.45)',
            }}>
            <IconSymbol name="xmark" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
