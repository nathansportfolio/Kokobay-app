import { Link } from 'expo-router';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { CatalogCoverImage } from '@/components/ui/catalog-cover-image';
import { Text } from '@/components/ui/text';
import { palette } from '@/constants/theme';
import { useProductHref } from '@/hooks/use-product-href';
import { showToast, useCartStore } from '@/store';
import type { CartLine } from '@/types/cart';
import { isLikelyRemoteImageUrl } from '@/utils/catalog-image';
import { lineSubtotalMoney, resolveCartLineUnitPrice } from '@/utils/cart-line-pricing';
import { inventoryLimitToast } from '@/utils/cart-inventory';
import { variantSnapshotValueLines } from '@/utils/cart-display';
import { cn } from '@/utils/cn';
import { hapticLight } from '@/utils/haptics';
import { formatCartMoney } from '@/utils/money';

const ICON = { strokeWidth: 1.25 as const };
const ICON_SOFT = { strokeWidth: 1.2 as const };

export type CartLineRowProps = {
  line: CartLine;
};

function resolveImageUrl(line: CartLine) {
  if (line.imageUrl && isLikelyRemoteImageUrl(line.imageUrl)) {
    return line.imageUrl.trim();
  }
  return undefined;
}

function CartLineRowInner({ line }: CartLineRowProps) {
  const productLink = useProductHref(line.handle);
  const imageUrl = resolveImageUrl(line);

  const title = line.title?.trim() || line.handle.replace(/-/g, ' ');

  const variantLines = useMemo(() => {
    const snap = line.variantTitle?.trim();
    if (snap) {
      const parsed = variantSnapshotValueLines(snap);
      if (parsed?.length) return parsed;
      return [snap];
    }
    return ['Variant'];
  }, [line.variantTitle]);

  const unit = resolveCartLineUnitPrice(line);
  const lineMoney = lineSubtotalMoney(line);
  const atCatalogCap = line.maxQty != null && line.qty >= line.maxQty;
  const atHardCap = line.qty >= 99;

  const bumpQty = (delta: number) => {
    hapticLight();
    if (delta < 0) {
      if (line.qty <= 1) {
        useCartStore.getState().removeItem(line.variantId);
        showToast({ variant: 'success', title: 'Removed from Bag' });
      } else {
        useCartStore.getState().updateQuantity(line.variantId, line.qty - 1);
      }
      return;
    }
    if (atHardCap || atCatalogCap) {
      if (line.maxQty != null) showToast(inventoryLimitToast(line.maxQty, { kind: 'max' }));
      return;
    }
    useCartStore.getState().updateQuantity(line.variantId, line.qty + 1);
  };

  return (
    <View className="mb-7">
      <View className="flex-row gap-5">
        <Link href={productLink} asChild>
          <Pressable
            className="active:opacity-90"
            accessibilityRole="link"
            accessibilityLabel={`View ${title}`}>
            <View className="h-[172px] w-[118px] overflow-hidden rounded-3xl bg-warmElevated">
              {imageUrl ? (
                <CatalogCoverImage
                  uri={imageUrl}
                  recyclingKey={`${line.handle}-${line.variantId}`}
                  priority="low"
                  transition={280}
                />
              ) : null}
            </View>
          </Pressable>
        </Link>

        <View className="min-w-0 flex-1 justify-between pt-0.5">
          <View>
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 pr-1">
                <Link href={productLink} asChild>
                  <Pressable accessibilityRole="link">
                    <Text
                      className="font-sans-semibold text-[17px] leading-[22px] tracking-[-0.2px] text-ink"
                      numberOfLines={2}>
                      {title}
                    </Text>
                  </Pressable>
                </Link>
                <View className="mt-3 gap-0.5">
                  {variantLines.map((row, i) => (
                    <Text
                      key={`${row}-${i}`}
                      className="font-sans text-[14px] leading-5 text-muted"
                      style={{ color: 'rgba(148, 147, 142, 0.92)' }}
                      numberOfLines={1}>
                      {row}
                    </Text>
                  ))}
                </View>
                {unit ? (
                  <Text
                    className="mt-2.5 font-sans text-[13px]"
                    style={{ color: 'rgba(92, 91, 88, 0.72)' }}>
                    {formatCartMoney(unit)}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => {
                  hapticLight();
                  useCartStore.getState().removeItem(line.variantId);
                  showToast({ variant: 'success', title: 'Removed from Bag' });
                }}
                accessibilityRole="button"
                accessibilityLabel="Remove from bag"
                hitSlop={12}
                className="rounded-full p-1.5 active:opacity-75">
                <Trash2 size={16} color="rgba(92, 91, 88, 0.78)" {...ICON_SOFT} />
              </Pressable>
            </View>
          </View>

          <View className="mt-7 flex-row items-center justify-between gap-4">
            <View className="flex-row items-center rounded-full bg-warmElevated px-0.5 py-0.5">
              <Pressable
                onPress={() => bumpQty(-1)}
                className="h-9 w-9 items-center justify-center rounded-full active:bg-warmSurface"
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity">
                <Minus size={16} color={palette.ink} {...ICON} />
              </Pressable>
              <View className="min-w-[36px] items-center justify-center px-0.5">
                <Text className="font-sans-semibold text-[15px] tracking-tight text-ink">{line.qty}</Text>
              </View>
              <Pressable
                onPress={() => bumpQty(1)}
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-full active:bg-warmSurface',
                  (atHardCap || atCatalogCap) && 'opacity-35',
                )}
                disabled={atHardCap || atCatalogCap}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity">
                <Plus size={16} color={palette.ink} {...ICON} />
              </Pressable>
            </View>
            <Text className="font-sans-semibold text-[15px] tracking-tight text-ink">
              {lineMoney ? formatCartMoney(lineMoney) : '—'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export const CartLineRow = memo(
  CartLineRowInner,
  (prev, next) =>
    prev.line.variantId === next.line.variantId &&
    prev.line.qty === next.line.qty &&
    prev.line.handle === next.line.handle &&
    prev.line.title === next.line.title &&
    prev.line.variantTitle === next.line.variantTitle &&
    prev.line.imageUrl === next.line.imageUrl &&
    prev.line.unitPrice?.amount === next.line.unitPrice?.amount &&
    prev.line.unitPrice?.currencyCode === next.line.unitPrice?.currencyCode &&
    prev.line.maxQty === next.line.maxQty,
);
