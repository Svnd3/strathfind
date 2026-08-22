import type { PropsWithChildren } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { palette, type as typeScale } from '@/constants/design';

export type AppTextVariant = keyof typeof typeScale;

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({
  variant = 'body',
  color = palette.ink,
  align,
  style,
  children,
  ...props
}: PropsWithChildren<AppTextProps>) {
  return (
    <Text
      {...props}
      style={[typeScale[variant], { color, textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}
