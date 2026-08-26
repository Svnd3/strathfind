import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, raisedShadow, spacing } from '@/constants/design';
import { useAppTheme } from '@/theme/app-theme';

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
  const { colors } = useAppTheme();
  const paddingValue = typeof padding === 'number' ? padding : spacing[padding];
  const toneStyle: ViewStyle =
    tone === 'inset'
      ? { backgroundColor: colors.inset, borderColor: colors.lineSoft, borderWidth: 1 }
      : tone === 'strong'
        ? { backgroundColor: colors.surfaceStrong, borderColor: colors.lineSoft, borderWidth: 1 }
        : tone === 'flat'
          ? { backgroundColor: colors.surface, borderColor: colors.lineSoft, borderWidth: 1 }
          : {
              backgroundColor: colors.surface,
              borderColor: colors.lineSoft,
              borderWidth: 1,
              ...raisedShadow('sm', colors.black),
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
