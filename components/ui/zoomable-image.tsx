import { Image, type ImageContentFit } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { catalogImageCache } from '@/constants/expo-image';
import { LUXURY_PINCH_SPRING, PDP_IMAGE_TRANSITION } from '@/constants/luxury-motion';
import {
  clampZoomTranslation,
  displayedImageSize,
  focalPointDoubleTapUpdate,
  focalPointScaleUpdate,
} from '@/utils/zoomable-image-math';

const DEFAULT_MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 3.2;
const DEFAULT_DOUBLE_TAP_SCALE = 2.5;
const ZOOM_LOCK_THRESHOLD = 1.02;
const ZOOM_OUT_SNAP = 1.04;

export type ZoomableImageProps = {
  uri: string;
  width: number;
  height: number;
  contentFit?: ImageContentFit;
  /** When false, animates back to identity (carousel page change, lightbox swipe). */
  isActive?: boolean;
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
  backgroundColor?: string;
  enableDoubleTap?: boolean;
  /** Fires on single tap (double-tap is handled internally). */
  onSingleTap?: () => void;
  /** True while pinch/pan zoom is active — parent can lock horizontal paging. */
  onZoomLockChange?: (locked: boolean) => void;
  className?: string;
};

function notifyZoomLock(
  locked: boolean,
  onZoomLockChange: ((locked: boolean) => void) | undefined,
  zoomLockedRef: SharedValue<boolean>,
) {
  'worklet';
  if (zoomLockedRef.value === locked) return;
  zoomLockedRef.value = locked;
  if (onZoomLockChange) {
    runOnJS(onZoomLockChange)(locked);
  }
}

function applyClamp(
  scale: SharedValue<number>,
  translateX: SharedValue<number>,
  translateY: SharedValue<number>,
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: SharedValue<number>,
  contentHeight: SharedValue<number>,
  animate: boolean,
): { translateX: number; translateY: number } {
  'worklet';
  const clamped = clampZoomTranslation({
    translateX: translateX.value,
    translateY: translateY.value,
    scale: scale.value,
    viewportWidth,
    viewportHeight,
    contentWidth: contentWidth.value,
    contentHeight: contentHeight.value,
  });

  if (animate) {
    translateX.value = withSpring(clamped.translateX, LUXURY_PINCH_SPRING);
    translateY.value = withSpring(clamped.translateY, LUXURY_PINCH_SPRING);
  } else {
    translateX.value = clamped.translateX;
    translateY.value = clamped.translateY;
  }

  return clamped;
}

function resetZoomState(
  scale: SharedValue<number>,
  translateX: SharedValue<number>,
  translateY: SharedValue<number>,
  pinchStartScale: SharedValue<number>,
  pinchStartTranslateX: SharedValue<number>,
  pinchStartTranslateY: SharedValue<number>,
  panStartTranslateX: SharedValue<number>,
  panStartTranslateY: SharedValue<number>,
  savedScale: SharedValue<number>,
  savedTranslateX: SharedValue<number>,
  savedTranslateY: SharedValue<number>,
  animate: boolean,
  minScale: number,
) {
  'worklet';
  const reset = (sv: SharedValue<number>, to: number) => {
    sv.value = animate ? withSpring(to, LUXURY_PINCH_SPRING) : to;
  };

  reset(scale, minScale);
  reset(translateX, 0);
  reset(translateY, 0);
  pinchStartScale.value = minScale;
  pinchStartTranslateX.value = 0;
  pinchStartTranslateY.value = 0;
  panStartTranslateX.value = 0;
  panStartTranslateY.value = 0;
  savedScale.value = minScale;
  savedTranslateX.value = 0;
  savedTranslateY.value = 0;
}

/** JS-thread reset — never call worklets from React effects (causes native crashes). */
function resetZoomFromJs(
  scale: SharedValue<number>,
  translateX: SharedValue<number>,
  translateY: SharedValue<number>,
  pinchStartScale: SharedValue<number>,
  pinchStartTranslateX: SharedValue<number>,
  pinchStartTranslateY: SharedValue<number>,
  panStartTranslateX: SharedValue<number>,
  panStartTranslateY: SharedValue<number>,
  savedScale: SharedValue<number>,
  savedTranslateX: SharedValue<number>,
  savedTranslateY: SharedValue<number>,
  animate: boolean,
  minScale: number,
): void {
  const apply = (sv: SharedValue<number>, to: number) => {
    sv.value = animate ? withSpring(to, LUXURY_PINCH_SPRING) : to;
  };

  apply(scale, minScale);
  apply(translateX, 0);
  apply(translateY, 0);
  pinchStartScale.value = minScale;
  pinchStartTranslateX.value = 0;
  pinchStartTranslateY.value = 0;
  panStartTranslateX.value = 0;
  panStartTranslateY.value = 0;
  savedScale.value = minScale;
  savedTranslateX.value = 0;
  savedTranslateY.value = 0;
}

function notifyZoomLockJs(
  locked: boolean,
  onZoomLockChange: ((locked: boolean) => void) | undefined,
  zoomLockedRef: SharedValue<boolean>,
): void {
  if (zoomLockedRef.value === locked) return;
  zoomLockedRef.value = locked;
  onZoomLockChange?.(locked);
}

export function ZoomableImage({
  uri,
  width,
  height,
  contentFit = 'contain',
  isActive = true,
  minScale = DEFAULT_MIN_SCALE,
  maxScale = DEFAULT_MAX_SCALE,
  doubleTapScale = DEFAULT_DOUBLE_TAP_SCALE,
  backgroundColor = 'transparent',
  enableDoubleTap = true,
  onSingleTap,
  onZoomLockChange,
  className,
}: ZoomableImageProps) {
  const scale = useSharedValue(minScale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedScale = useSharedValue(minScale);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchStartScale = useSharedValue(minScale);
  const pinchStartTranslateX = useSharedValue(0);
  const pinchStartTranslateY = useSharedValue(0);

  const panStartTranslateX = useSharedValue(0);
  const panStartTranslateY = useSharedValue(0);

  const contentWidth = useSharedValue(width);
  const contentHeight = useSharedValue(height);
  const zoomLockedRef = useSharedValue(false);

  const fitMode = contentFit === 'cover' ? 'cover' : 'contain';

  useEffect(() => {
    contentWidth.value = width;
    contentHeight.value = height;
  }, [width, height, contentWidth, contentHeight]);

  useEffect(() => {
    if (isActive) return;
    resetZoomFromJs(
      scale,
      translateX,
      translateY,
      pinchStartScale,
      pinchStartTranslateX,
      pinchStartTranslateY,
      panStartTranslateX,
      panStartTranslateY,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      true,
      minScale,
    );
    notifyZoomLockJs(false, onZoomLockChange, zoomLockedRef);
  }, [isActive, minScale, onZoomLockChange]); // eslint-disable-line react-hooks/exhaustive-deps -- shared values

  useEffect(() => {
    resetZoomFromJs(
      scale,
      translateX,
      translateY,
      pinchStartScale,
      pinchStartTranslateX,
      pinchStartTranslateY,
      panStartTranslateX,
      panStartTranslateY,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      false,
      minScale,
    );
    notifyZoomLockJs(false, onZoomLockChange, zoomLockedRef);
  }, [uri, width, height, minScale, onZoomLockChange]); // eslint-disable-line react-hooks/exhaustive-deps -- shared values

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      pinchStartScale.value = scale.value;
      pinchStartTranslateX.value = translateX.value;
      pinchStartTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const next = focalPointScaleUpdate({
        focalX: e.focalX,
        focalY: e.focalY,
        viewportWidth: width,
        viewportHeight: height,
        startScale: pinchStartScale.value,
        startTranslateX: pinchStartTranslateX.value,
        startTranslateY: pinchStartTranslateY.value,
        gestureScale: e.scale,
        minScale,
        maxScale,
      });
      scale.value = next.scale;
      translateX.value = next.translateX;
      translateY.value = next.translateY;
      if (scale.value > ZOOM_LOCK_THRESHOLD) {
        notifyZoomLock(true, onZoomLockChange, zoomLockedRef);
      }
    })
    .onEnd(() => {
      if (scale.value < ZOOM_OUT_SNAP) {
        resetZoomState(
          scale,
          translateX,
          translateY,
          pinchStartScale,
          pinchStartTranslateX,
          pinchStartTranslateY,
          panStartTranslateX,
          panStartTranslateY,
          savedScale,
          savedTranslateX,
          savedTranslateY,
          true,
          minScale,
        );
        notifyZoomLock(false, onZoomLockChange, zoomLockedRef);
        return;
      }

      const clamped = applyClamp(
        scale,
        translateX,
        translateY,
        width,
        height,
        contentWidth,
        contentHeight,
        true,
      );
      savedScale.value = scale.value;
      savedTranslateX.value = clamped.translateX;
      savedTranslateY.value = clamped.translateY;
      notifyZoomLock(scale.value > ZOOM_LOCK_THRESHOLD, onZoomLockChange, zoomLockedRef);
    });

  // Pan only when zoomed — fails at scale 1 so carousel/pager keeps horizontal swipe.
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (scale.value > ZOOM_LOCK_THRESHOLD) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onBegin(() => {
      panStartTranslateX.value = translateX.value;
      panStartTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = panStartTranslateX.value + e.translationX;
      translateY.value = panStartTranslateY.value + e.translationY;
      notifyZoomLock(true, onZoomLockChange, zoomLockedRef);
    })
    .onEnd(() => {
      const clamped = applyClamp(
        scale,
        translateX,
        translateY,
        width,
        height,
        contentWidth,
        contentHeight,
        true,
      );
      savedTranslateX.value = clamped.translateX;
      savedTranslateY.value = clamped.translateY;
      notifyZoomLock(scale.value > ZOOM_LOCK_THRESHOLD, onZoomLockChange, zoomLockedRef);
    });

  const doubleTap = Gesture.Tap()
    .enabled(enableDoubleTap)
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((e) => {
      const next = focalPointDoubleTapUpdate({
        tapX: e.x,
        tapY: e.y,
        viewportWidth: width,
        viewportHeight: height,
        currentScale: scale.value,
        currentTranslateX: translateX.value,
        currentTranslateY: translateY.value,
        zoomInScale: doubleTapScale,
        zoomOutThreshold: ZOOM_LOCK_THRESHOLD,
      });

      if (next.zoomingIn) {
        const clamped = clampZoomTranslation({
          translateX: next.translateX,
          translateY: next.translateY,
          scale: next.scale,
          viewportWidth: width,
          viewportHeight: height,
          contentWidth: contentWidth.value,
          contentHeight: contentHeight.value,
        });
        scale.value = withSpring(next.scale, LUXURY_PINCH_SPRING);
        translateX.value = withSpring(clamped.translateX, LUXURY_PINCH_SPRING);
        translateY.value = withSpring(clamped.translateY, LUXURY_PINCH_SPRING);
        savedScale.value = next.scale;
        savedTranslateX.value = clamped.translateX;
        savedTranslateY.value = clamped.translateY;
        notifyZoomLock(true, onZoomLockChange, zoomLockedRef);
        return;
      }

      scale.value = withSpring(1, LUXURY_PINCH_SPRING);
      translateX.value = withSpring(0, LUXURY_PINCH_SPRING);
      translateY.value = withSpring(0, LUXURY_PINCH_SPRING);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      notifyZoomLock(false, onZoomLockChange, zoomLockedRef);
    });

  const singleTap = Gesture.Tap()
    .enabled(Boolean(onSingleTap && uri))
    .numberOfTaps(1)
    .maxDuration(320)
    .onEnd(() => {
      'worklet';
      if (onSingleTap) {
        runOnJS(onSingleTap)();
      }
    });

  const taps = Gesture.Exclusive(doubleTap, singleTap);
  const gestures = Gesture.Simultaneous(pinch, pan, taps);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!uri) {
    return <View style={{ width, height, backgroundColor }} />;
  }

  return (
    <GestureDetector gesture={gestures}>
      <Animated.View
        className={className}
        style={[{ width, height, backgroundColor, overflow: 'hidden' }, animatedStyle]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          contentFit={contentFit}
          transition={PDP_IMAGE_TRANSITION}
          onLoad={(event) => {
            const source = event.source;
            const imgW = source.width ?? width;
            const imgH = source.height ?? height;
            const displayed = displayedImageSize({
              imageWidth: imgW,
              imageHeight: imgH,
              viewportWidth: width,
              viewportHeight: height,
              contentFit: fitMode,
            });
            contentWidth.value = displayed.width;
            contentHeight.value = displayed.height;
          }}
          {...catalogImageCache}
        />
      </Animated.View>
    </GestureDetector>
  );
}
