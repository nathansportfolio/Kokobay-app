/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './constants/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './store/**/*.{js,jsx,ts,tsx}',
    './services/**/*.{js,jsx,ts,tsx}',
    './utils/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#F8F7F5',
        /** Warm luxury neutrals — editorial surfaces (cart, soft panels) */
        warmCanvas: '#FAF8F5',
        warmSurface: '#F7F4EF',
        warmElevated: '#F5F3F0',
        surface: '#FFFFFF',
        elevated: '#EDECE8',
        ink: '#141414',
        mist: '#5C5B58',
        muted: '#94938E',
        line: '#E2E0DC',
        accent: '#6E5E4F',
        accentSoft: '#8A7E72',
        formBg: '#FAF9F7',
        formBorder: '#ECE8E3',
        formPlaceholder: '#9A9A9A',
      },
      fontFamily: {
        sans: ['InstrumentSans-Regular'],
        'sans-md': ['InstrumentSans-Medium'],
        'sans-semibold': ['InstrumentSans-SemiBold'],
        'sans-bold': ['InstrumentSans-Bold'],
      },
      letterSpacing: {
        caps: '0.22em',
        wide: '0.04em',
      },
    },
  },
  plugins: [],
};
