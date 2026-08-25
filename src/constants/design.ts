import { Platform, type TextStyle, type ViewStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});

export const palette = {
  wine: '#711C3A',
  wineDark: '#491126',
  winePressed: '#5B1730',
  wineSoft: '#F1E2E7',
  yellow: '#F2C45E',
  teal: '#215C60',
  tealDark: '#153F43',
  tealSoft: '#DDEBE8',
  ink: '#241B1E',
  inkSoft: '#574B4F',
  muted: '#706267',
  canvas: '#F6F1EA',
  surface: '#FAF6F0',
  surfaceStrong: '#FFFCF7',
  inset: '#EDE5DC',
  line: '#8B777E',
  lineSoft: '#DDD0C8',
  white: '#FFFCF7',
  black: '#000000',
  success: '#245D41',
  successSoft: '#DCECE3',
  warning: '#745100',
  warningSoft: '#F5E9BC',
  danger: '#9A213A',
  dangerSoft: '#F5DDE3',
  blue: '#315C78',
  blueSoft: '#DEEAF1',
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
  h1: { fontFamily: systemFont, fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.7 } satisfies TextStyle,
  h2: { fontFamily: systemFont, fontSize: 24, lineHeight: 28, fontWeight: '700', letterSpacing: -0.45 } satisfies TextStyle,
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
    sm: { offset: 3, blur: 10, opacity: 0.09, elevation: 2 },
    md: { offset: 8, blur: 24, opacity: 0.12, elevation: 5 },
    lg: { offset: 14, blur: 38, opacity: 0.16, elevation: 8 },
  }[level];

  if (Platform.OS === 'web') {
    return {
      boxShadow: `0 ${values.offset}px ${values.blur}px rgba(91, 58, 68, ${values.opacity})`,
    } as ViewStyle;
  }

  return {
    shadowColor: '#5B3A44',
    shadowOffset: { width: 0, height: values.offset },
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
