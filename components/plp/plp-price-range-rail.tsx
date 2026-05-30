import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import type { PlpFilters } from '@/types/plp';
import { formatMoney } from '@/utils/money';
import { PLP_PRICE_SLIDER_EPS } from '@/utils/plp';

const THUMB_R = 14;
const THUMB_D = THUMB_R * 2;
const RAIL_H = 4;
const USE_BLUR = Platform.OS === 'ios';

const thumbShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 4,
} as const;

function PriceSliderGlassThumb({
  panHandlers,
  accessibilityLabel,
  left,
  zIndex,
}: {
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  accessibilityLabel: string;
  left: number;
  zIndex: number;
}) {
  return (
    <View
      {...panHandlers}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={{
        position: 'absolute',
        width: THUMB_D,
        height: THUMB_D,
        borderRadius: THUMB_R,
        left: left - THUMB_R,
        top: 0,
        zIndex,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        ...thumbShadow,
      }}>
      <View style={styles.thumbFill} />
    </View>
  );
}

function PriceRangeValuePill({ children }: { children: string }) {
  return (
    <View
      style={[
        styles.valuePillShell,
        thumbShadow,
        !USE_BLUR && styles.valuePillAndroid,
      ]}>
      {USE_BLUR ? (
        <>
          <BlurView intensity={36} tint="light" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.valuePillWhiteLift} />
        </>
      ) : null}
      <Text variant="caption" className="px-3.5 py-1.5 text-center font-sans-md text-[13px] text-ink">
        {children}
      </Text>
    </View>
  );
}

function snapToStep(v: number, step: number, lo: number, hi: number): number {
  const s = Math.round(v / step) * step;
  return Math.min(Math.max(s, lo), hi);
}

type Props = {
  catalogMin: number;
  catalogMax: number;
  step: number;
  currencyCode: string;
  draft: PlpFilters;
  onChangeDraft: (next: PlpFilters) => void;
};

export function PlpPriceRangeRail({
  catalogMin,
  catalogMax,
  step,
  currencyCode,
  draft,
  onChangeDraft,
}: Props) {
  const [railW, setRailW] = useState(0);
  const usable = Math.max(railW - THUMB_D, 0);
  const range = Math.max(catalogMax - catalogMin, PLP_PRICE_SLIDER_EPS);

  const money = useCallback(
    (amount: number) => formatMoney({ amount: amount.toFixed(2), currencyCode }),
    [currencyCode],
  );

  const lowVal = draft.priceMin ?? catalogMin;
  const highVal = draft.priceMax ?? catalogMax;
  const displayLow = Math.min(Math.max(catalogMin, lowVal), highVal);
  const displayHigh = Math.max(Math.min(catalogMax, highVal), displayLow);

  const dragRef = useRef({ startLow: displayLow, startHigh: displayHigh });
  const draftRef = useRef(draft);
  const onChangeDraftRef = useRef(onChangeDraft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    onChangeDraftRef.current = onChangeDraft;
  }, [onChangeDraft]);

  const valToCenterX = useCallback(
    (v: number) => {
      if (usable <= 0) return THUMB_R;
      const t = (v - catalogMin) / range;
      return THUMB_R + t * usable;
    },
    [usable, catalogMin, range],
  );

  const minCenterX = valToCenterX(displayLow);
  const maxCenterX = valToCenterX(displayHigh);

  const applyMin = useCallback(
    (v: number) => {
      const current = draftRef.current;
      const maxBound = current.priceMax ?? catalogMax;
      const nextVal = snapToStep(v, step, catalogMin, catalogMax);
      if (nextVal > maxBound + PLP_PRICE_SLIDER_EPS) {
        onChangeDraftRef.current({
          ...current,
          priceMin: nextVal <= catalogMin + PLP_PRICE_SLIDER_EPS ? null : nextVal,
          priceMax: null,
        });
        return;
      }
      const nextMin = nextVal <= catalogMin + PLP_PRICE_SLIDER_EPS ? null : nextVal;
      onChangeDraftRef.current({ ...current, priceMin: nextMin });
    },
    [catalogMin, catalogMax, step],
  );

  const applyMax = useCallback(
    (v: number) => {
      const current = draftRef.current;
      const minBound = current.priceMin ?? catalogMin;
      const nextVal = snapToStep(v, step, catalogMin, catalogMax);
      if (nextVal < minBound - PLP_PRICE_SLIDER_EPS) {
        onChangeDraftRef.current({
          ...current,
          priceMin: null,
          priceMax: nextVal >= catalogMax - PLP_PRICE_SLIDER_EPS ? null : nextVal,
        });
        return;
      }
      const nextMax = nextVal >= catalogMax - PLP_PRICE_SLIDER_EPS ? null : nextVal;
      onChangeDraftRef.current({ ...current, priceMax: nextMax });
    },
    [catalogMin, catalogMax, step],
  );

  const captureHorizontalPan = useCallback(() => true, []);
  const shouldCaptureHorizontalPan = useCallback(
    (_: unknown, g: { dx: number; dy: number }) =>
      Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 4,
    [],
  );

  const minPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: captureHorizontalPan,
        onMoveShouldSetPanResponder: shouldCaptureHorizontalPan,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const current = draftRef.current;
          dragRef.current = {
            startLow: current.priceMin ?? catalogMin,
            startHigh: current.priceMax ?? catalogMax,
          };
        },
        onPanResponderMove: (_, g) => {
          if (usable <= 0) return;
          const deltaVal = (g.dx / usable) * range;
          const v = Math.min(Math.max(dragRef.current.startLow + deltaVal, catalogMin), catalogMax);
          applyMin(v);
        },
      }),
    [usable, range, catalogMin, catalogMax, applyMin, captureHorizontalPan, shouldCaptureHorizontalPan],
  );

  const maxPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: captureHorizontalPan,
        onMoveShouldSetPanResponder: shouldCaptureHorizontalPan,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const current = draftRef.current;
          dragRef.current = {
            startLow: current.priceMin ?? catalogMin,
            startHigh: current.priceMax ?? catalogMax,
          };
        },
        onPanResponderMove: (_, g) => {
          if (usable <= 0) return;
          const deltaVal = (g.dx / usable) * range;
          const v = Math.min(Math.max(dragRef.current.startHigh + deltaVal, catalogMin), catalogMax);
          applyMax(v);
        },
      }),
    [usable, range, catalogMin, catalogMax, applyMax, captureHorizontalPan, shouldCaptureHorizontalPan],
  );

  const thumbsOverlap = maxCenterX - minCenterX < THUMB_D + 4;

  const onRailLayout = useCallback((e: LayoutChangeEvent) => {
    setRailW(e.nativeEvent.layout.width);
  }, []);

  const minLabel =
    draft.priceMin == null ||
    (catalogMax > catalogMin && draft.priceMin <= catalogMin + PLP_PRICE_SLIDER_EPS)
      ? 'Any'
      : money(Math.round(draft.priceMin));

  const maxLabel =
    draft.priceMax == null ||
    (catalogMax > catalogMin && draft.priceMax >= catalogMax - PLP_PRICE_SLIDER_EPS)
      ? 'Any'
      : money(Math.round(draft.priceMax));

  const fillLeft = minCenterX;
  const fillWidth = Math.max(maxCenterX - minCenterX, 0);

  return (
    <View>
      <View className="mb-2 items-center">
        <PriceRangeValuePill>{`${minLabel} — ${maxLabel}`}</PriceRangeValuePill>
      </View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text variant="caption" className="text-muted">
          {money(catalogMin)}
        </Text>
        <Text variant="caption" className="text-muted">
          {money(catalogMax)}
        </Text>
      </View>

      <View className="py-3" onLayout={onRailLayout}>
        <View className="relative" style={{ height: THUMB_D, justifyContent: 'center' }}>
          {/* full track */}
          <View
            pointerEvents="none"
            style={{
              marginHorizontal: THUMB_R,
              height: RAIL_H,
              borderRadius: RAIL_H / 2,
              backgroundColor: 'rgba(226, 224, 220, 0.85)',
            }}
          />
          {/* selected range */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: fillLeft,
              width: fillWidth,
              height: RAIL_H,
              top: (THUMB_D - RAIL_H) / 2,
              borderRadius: RAIL_H / 2,
              backgroundColor: palette.ink,
            }}
          />
          {/* max thumb — rendered before min so the min thumb stays on top when they overlap */}
          <PriceSliderGlassThumb
            panHandlers={maxPan.panHandlers}
            accessibilityLabel="Maximum price"
            left={maxCenterX}
            zIndex={thumbsOverlap ? 1 : 2}
          />
          {/* min thumb */}
          <PriceSliderGlassThumb
            panHandlers={minPan.panHandlers}
            accessibilityLabel="Minimum price"
            left={minCenterX}
            zIndex={thumbsOverlap ? 2 : 1}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.ink,
  },
  valuePillShell: {
    alignSelf: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: USE_BLUR ? 'transparent' : undefined,
  },
  valuePillAndroid: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  valuePillWhiteLift: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
