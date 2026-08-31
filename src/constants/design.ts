import { Platform, type TextStyle, type ViewStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
});

export const lightPalette = {
  // `wine` is the accessible red accent used for text, icons, and outlines.
  // Filled controls use the primary tokens below so foreground contrast is
  // explicit in both themes.
  wine: '#B10F34',
  wineDark: '#950C2B',
  winePressed: '#A90F31',
  wineSoft: '#FFE1E7',
  primary: '#C3133A',
  primaryHover: '#A90F31',
  primaryPressed: '#950C2B',
  onPrimary: '#FFF9FA',
  yellow: '#F4C44E',
  teal: '#007A64',
  tealDark: '#006653',
  tealSoft: '#D7F5ED',
  found: '#007A64',
  foundHover: '#006653',
  foundPressed: '#004F43',
  onFound: '#FFFDFC',
  cardRed: '#FA1747',
  cardRedPressed: '#D9163B',
  cardGreen: '#00A884',
  cardGreenPressed: '#00856A',
  onCardRed: '#171013',
  onCardGreen: '#14211F',
  ink: '#21191C',
  inkSoft: '#50464A',
  muted: '#675C60',
  canvas: '#F7F4F1',
  surface: '#FBF8F6',
  surfaceStrong: '#FFFDFC',
  inset: '#EEE8E6',
  line: '#86777C',
  lineSoft: '#DCCFD2',
  white: '#FFFDFC',
  black: '#111113',
  success: '#176B4F',
  successSoft: '#D8F0E7',
  onSuccess: '#FFFDFC',
  warning: '#745100',
  warningSoft: '#F6E9B7',
  onWarning: '#FFFDFC',
  danger: '#A60F35',
  dangerSoft: '#FFE0E7',
  onDanger: '#FFFDFC',
  blue: '#285F86',
  blueSoft: '#DDECF5',
  onInfo: '#FFFDFC',
  scrim: 'rgba(17, 17, 19, 0.58)',
} as const;

export type AppPalette = { [Key in keyof typeof lightPalette]: string };

export const darkPalette: AppPalette = {
  wine: '#FF667F',
  wineDark: '#FF8A9E',
  winePressed: '#A60D30',
  wineSoft: '#401522',
  primary: '#C3133A',
  primaryHover: '#D81B45',
  primaryPressed: '#950C2B',
  onPrimary: '#FFF9FA',
  yellow: '#F4C44E',
  teal: '#35C9AC',
  tealDark: '#72E0C9',
  tealSoft: '#123B34',
  found: '#00A884',
  foundHover: '#00BFA5',
  foundPressed: '#00856A',
  onFound: '#14211F',
  cardRed: '#FA1747',
  cardRedPressed: '#D9163B',
  cardGreen: '#00A884',
  cardGreenPressed: '#00856A',
  onCardRed: '#171013',
  onCardGreen: '#14211F',
  ink: '#F7F1F3',
  inkSoft: '#D8CDD1',
  muted: '#BDAFB4',
  canvas: '#111113',
  surface: '#19191C',
  surfaceStrong: '#222226',
  inset: '#2D2D32',
  line: '#95858B',
  lineSoft: '#4B4145',
  white: '#FFF9FA',
  black: '#111113',
  success: '#72D7AD',
  successSoft: '#153A2D',
  onSuccess: '#111113',
  warning: '#F4D078',
  warningSoft: '#40330F',
  onWarning: '#111113',
  danger: '#FF7188',
  dangerSoft: '#481522',
  onDanger: '#111113',
  blue: '#83BDE2',
  blueSoft: '#16364A',
  onInfo: '#111113',
  scrim: 'rgba(0, 0, 0, 0.72)',
};

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
  wordmark: { fontFamily: 'Decog', fontSize: 20, lineHeight: 24, fontWeight: '400' } satisfies TextStyle,
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

function withOpacity(color: string, opacity: number): string {
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!hex) return color;

  const [, red, green, blue] = hex;
  return `rgba(${Number.parseInt(red, 16)}, ${Number.parseInt(green, 16)}, ${Number.parseInt(blue, 16)}, ${opacity})`;
}

export function raisedShadow(
  level: 'sm' | 'md' | 'lg' = 'md',
  shadowColor: string = '#5B3A44',
): ViewStyle {
  const values = {
    sm: { offset: 3, blur: 10, opacity: 0.09, elevation: 2 },
    md: { offset: 8, blur: 24, opacity: 0.12, elevation: 5 },
    lg: { offset: 14, blur: 38, opacity: 0.16, elevation: 8 },
  }[level];

  if (Platform.OS === 'web') {
    return {
      boxShadow: `0 ${values.offset}px ${values.blur}px ${withOpacity(shadowColor, values.opacity)}`,
    } as ViewStyle;
  }

  return {
    shadowColor,
    shadowOffset: { width: 0, height: values.offset },
    shadowOpacity: values.opacity,
    shadowRadius: values.blur / 2,
    elevation: values.elevation,
  };
}

export function focusRing(focused: boolean, color: string = lightPalette.wine): ViewStyle {
  // Web gets an input-modality-aware ring from `*:focus-visible` in
  // global.css. React Native's `onFocus` also fires for pointer clicks, so
  // drawing this border on web makes an ordinary click look like a hover
  // error state.
  if (!focused || Platform.OS === 'web') return {};
  return {
    borderColor: color,
    borderWidth: 2,
  };
}

export function hoverShadow(
  hovered: boolean,
  shadowColor: string = lightPalette.black,
): ViewStyle {
  return hovered && Platform.OS === 'web' ? raisedShadow('sm', shadowColor) : {};
}
