import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Info,
  type LucideIcon,
} from 'lucide-react-native';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export type ToastVariantTheme = {
  backgroundColor: string;
  titleColor: string;
  descriptionColor: string;
  iconColor: string;
  borderColor: string;
  Icon: LucideIcon;
};

/** Shared layout — all variants use the same geometry and typography scale. */
export const TOAST_LAYOUT = {
  maxWidth: 360,
  paddingHorizontal: 18,
  paddingVertical: 12,
  borderRadius: 4,
  borderWidth: 1,
  gap: 10,
  iconSize: 18,
  title: {
    fontFamily: 'InstrumentSans-Medium',
    fontSize: 14,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  description: {
    fontFamily: 'InstrumentSans-Regular',
    fontSize: 13,
    letterSpacing: 0.15,
    lineHeight: 18,
    marginTop: 2,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const TOAST_VARIANTS: Record<ToastVariant, ToastVariantTheme> = {
  success: {
    backgroundColor: '#111111',
    titleColor: '#FFFFFF',
    descriptionColor: 'rgba(255,255,255,0.78)',
    iconColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.12)',
    Icon: CircleCheck,
  },
  info: {
    backgroundColor: '#1F2937',
    titleColor: '#FFFFFF',
    descriptionColor: 'rgba(255,255,255,0.78)',
    iconColor: '#60A5FA',
    borderColor: 'rgba(96,165,250,0.28)',
    Icon: Info,
  },
  warning: {
    backgroundColor: '#FFFBEB',
    titleColor: '#92400E',
    descriptionColor: 'rgba(146,64,14,0.82)',
    iconColor: '#F59E0B',
    borderColor: 'rgba(245,158,11,0.35)',
    Icon: AlertTriangle,
  },
  error: {
    backgroundColor: '#FEF2F2',
    titleColor: '#991B1B',
    descriptionColor: 'rgba(153,27,27,0.82)',
    iconColor: '#DC2626',
    borderColor: 'rgba(220,38,38,0.28)',
    Icon: CircleX,
  },
};
