import { Platform, type TextStyle, type ViewStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});

export const palette = {
  wine: '#7B0323',
  wineDark: '#520017',
  winePressed: '#65021D',
  wineSoft: '#F0DDE3',
  yellow: '#FFFF2E',
  ink: '#21171A',
  inkSoft: '#55494D',
  muted: '#6D5E63',
  canvas: '#F2ECE8',
  surface: '#F6F1ED',
  surfaceStrong: '#FFFDFC',
  inset: '#E8DEDA',
  line: '#8A747B',
  lineSoft: '#D3C6C1',
  white: '#FFFDFC',
  black: '#000000',
  success: '#245D41',
  successSoft: '#DCECE3',
  warning: '#745100',
  warningSoft: '#F5E9BC',
  danger: '#9A213A',
  dangerSoft: '#F5DDE3',
  blue: '#245A70',
  blueSoft: '#DCECF1',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 64,
  hero: 96,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const type = {
  display: { fontFamily: systemFont, fontSize: 52, lineHeight: 52, fontWeight: '700', letterSpacing: -1.6 } satisfies TextStyle,
  h1: { fontFamily: systemFont, fontSize: 32, lineHeight: 32, fontWeight: '700', letterSpacing: -0.8 } satisfies TextStyle,
  h2: { fontFamily: systemFont, fontSize: 28, lineHeight: 28, fontWeight: '700', letterSpacing: -0.56 } satisfies TextStyle,
  h3: { fontFamily: systemFont, fontSize: 20, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2 } satisfies TextStyle,
  body: { fontFamily: systemFont, fontSize: 16, lineHeight: 24, fontWeight: '400' } satisfies TextStyle,
  bodyStrong: { fontFamily: systemFont, fontSize: 16, lineHeight: 22, fontWeight: '600' } satisfies TextStyle,
  support: { fontFamily: systemFont, fontSize: 14, lineHeight: 20, fontWeight: '500' } satisfies TextStyle,
  micro: { fontFamily: systemFont, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 } satisfies TextStyle,
} as const;

export const layout = {
  marketingMax: 1280,
  appMax: 1180,
  readingMax: 680,
  gutter: 24,
  mobileGutter: 16,
  controlHeight: 52,
  touchTarget: 48,
} as const;

export function raisedShadow(level: 'sm' | 'md' | 'lg' = 'md'): ViewStyle {
  const values = {
    sm: { offset: 3, blur: 8, opacity: 0.14, elevation: 2 },
    md: { offset: 7, blur: 18, opacity: 0.17, elevation: 5 },
    lg: { offset: 12, blur: 30, opacity: 0.2, elevation: 8 },
  }[level];

  if (Platform.OS === 'web') {
    return {
      boxShadow: `${values.offset}px ${values.offset}px ${values.blur}px rgba(91, 58, 68, ${values.opacity}), -${values.offset}px -${values.offset}px ${values.blur}px rgba(255, 255, 255, 0.88)`,
    } as ViewStyle;
  }

  return {
    shadowColor: '#5B3A44',
    shadowOffset: { width: values.offset, height: values.offset },
    shadowOpacity: values.opacity,
    shadowRadius: values.blur / 2,
    elevation: values.elevation,
  };
}

export function focusRing(focused: boolean): ViewStyle {
  if (!focused) return {};
  return {
    borderColor: palette.wine,
    borderWidth: 2,
  };
}
