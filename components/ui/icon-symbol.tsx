import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  LayoutGrid,
  LayoutList,
  Menu,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import { OpaqueColorValue, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

/** Legacy SF Symbol-style names — all render via Lucide for parity on iOS and Android. */
export type IconSymbolName =
  | 'arrow.up.arrow.down'
  | 'chevron.down'
  | 'chevron.left'
  | 'chevron.right'
  | 'chevron.up'
  | 'heart'
  | 'heart.fill'
  | 'line.3.horizontal'
  | 'magnifyingglass'
  | 'rectangle.split.1x2'
  | 'slider.horizontal.3'
  | 'square.grid.2x2'
  | 'trash.fill'
  | 'xmark';

type LegacyWeight = 'ultralight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';

function strokeWidthForWeight(weight?: LegacyWeight | string): number {
  switch (weight) {
    case 'ultralight':
    case 'thin':
      return 1.35;
    case 'light':
      return 1.55;
    case 'medium':
    case 'semibold':
      return 2.05;
    case 'bold':
    case 'heavy':
    case 'black':
      return 2.35;
    case 'regular':
    default:
      return 1.75;
  }
}

const lucideBase = (strokeWidth: number): Partial<LucideProps> => ({
  strokeWidth,
  pointerEvents: 'none' as const,
});

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
  symbolType: _symbolType,
  symbolScale: _symbolScale,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle | TextStyle>;
  weight?: LegacyWeight | string;
  symbolType?: string;
  symbolScale?: string;
}) {
  const stroke = strokeWidthForWeight(weight);
  const c = color as string;
  const common = { size, color: c, ...lucideBase(stroke), style: style as LucideProps['style'] };

  switch (name) {
    case 'chevron.left':
      return <ChevronLeft {...common} />;
    case 'chevron.right':
      return <ChevronRight {...common} />;
    case 'chevron.down':
      return <ChevronDown {...common} />;
    case 'chevron.up':
      return <ChevronUp {...common} />;
    case 'heart':
      return <Heart {...common} fill="transparent" />;
    case 'heart.fill':
      return <Heart {...common} fill={c} />;
    case 'line.3.horizontal':
      return <Menu {...common} />;
    case 'magnifyingglass':
      return <Search {...common} />;
    case 'slider.horizontal.3':
      return <SlidersHorizontal {...common} />;
    case 'arrow.up.arrow.down':
      return <ArrowUpDown {...common} />;
    case 'square.grid.2x2':
      return <LayoutGrid {...common} />;
    case 'rectangle.split.1x2':
      return <LayoutList {...common} />;
    case 'trash.fill':
      return <Trash2 {...common} />;
    case 'xmark':
      return <X {...common} />;
    default:
      return <Search {...common} />;
  }
}
