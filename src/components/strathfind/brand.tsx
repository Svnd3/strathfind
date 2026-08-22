import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { palette, spacing } from '@/constants/design';

import { AppText } from './typography';

export interface BrandMarkProps {
  size?: number;
  style?: ViewStyle;
  decorative?: boolean;
}

/** Production vector mark, rendered natively without an SVG asset loader. */
export function BrandMark({ size = 48, style, decorative = false }: BrandMarkProps) {
  return (
    <View
      accessibilityElementsHidden={decorative}
      accessibilityLabel={decorative ? undefined : 'StrathFind'}
      accessibilityRole={decorative ? undefined : 'image'}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Rect width="1024" height="1024" rx="224" fill={palette.wine} />
        <Circle cx="414" cy="394" r="248" fill={palette.black} />
        <Path
          d="M568 548 774 754"
          fill="none"
          stroke={palette.black}
          strokeWidth="128"
          strokeLinecap="round"
        />
        <Circle cx="414" cy="394" r="164" fill={palette.yellow} />
      </Svg>
    </View>
  );
}

export interface BrandLockupProps {
  markSize?: number;
  inverse?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}

export function BrandLockup({ markSize = 44, inverse = false, compact = false, style }: BrandLockupProps) {
  return (
    <View
      accessible
      accessibilityLabel="StrathFind"
      accessibilityRole="image"
      style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]}
    >
      <BrandMark size={markSize} decorative />
      {!compact ? (
        <AppText variant="h3" color={inverse ? palette.white : palette.wine}>
          StrathFind
        </AppText>
      ) : null}
    </View>
  );
}
