import { DefaultTheme, type Theme } from '@react-navigation/native';

/** Editorial luxury palette — light neutrals, warm stone accent */
export const palette = {
  canvas: '#F8F7F5',
  surface: '#FFFFFF',
  elevated: '#EDECE8',
  ink: '#141414',
  mist: '#5C5B58',
  muted: '#94938E',
  line: '#E2E0DC',
  accent: '#6E5E4F',
  accentSoft: '#8A7E72',
} as const;

/** Legacy template hook support */
export const Colors = {
  light: {
    text: palette.ink,
    background: palette.canvas,
    tint: palette.accent,
    icon: palette.mist,
    tabIconDefault: palette.muted,
    tabIconSelected: palette.ink,
  },
  dark: {
    text: palette.ink,
    background: palette.canvas,
    tint: palette.accent,
    icon: palette.mist,
    tabIconDefault: palette.muted,
    tabIconSelected: palette.ink,
  },
} as const;

export const navigationTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.accent,
    background: palette.canvas,
    card: palette.surface,
    text: palette.ink,
    border: palette.line,
    notification: palette.accent,
  },
  fonts: {
    regular: {
      fontFamily: 'InstrumentSans-Regular',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'InstrumentSans-Medium',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'InstrumentSans-Bold',
      fontWeight: '700',
    },
    heavy: {
      fontFamily: 'InstrumentSans-Bold',
      fontWeight: '700',
    },
  },
};
