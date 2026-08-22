import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { palette, radius, raisedShadow, spacing } from '@/constants/design';

export type SurfaceTone = 'raised' | 'flat' | 'inset' | 'strong';

export interface SurfaceProps extends ViewProps {
  tone?: SurfaceTone;
  padding?: keyof typeof spacing | number;
  radiusSize?: keyof typeof radius;
  style?: StyleProp<ViewStyle>;
}

export function Surface({
  tone = 'raised',
  padding = 'md',
  radiusSize = 'lg',
  style,
  children,
  ...props
}: PropsWithChildren<SurfaceProps>) {
  const paddingValue = typeof padding === 'number' ? padding : spacing[padding];
  const toneStyle: ViewStyle =
    tone === 'inset'
      ? { backgroundColor: palette.inset, borderColor: palette.lineSoft, borderWidth: 1 }
      : tone === 'strong'
        ? { backgroundColor: palette.surfaceStrong, borderColor: palette.lineSoft, borderWidth: 1 }
        : tone === 'flat'
          ? { backgroundColor: palette.surface, borderColor: palette.lineSoft, borderWidth: 1 }
          : {
              backgroundColor: palette.surface,
              borderColor: 'rgba(255,255,255,0.62)',
              borderWidth: 1,
              ...raisedShadow('sm'),
            };

  return (
    <View
      {...props}
      style={[
        toneStyle,
        { padding: paddingValue, borderRadius: radius[radiusSize] },
        style,
      ]}
    >
      {children}
    </View>
  );
}
