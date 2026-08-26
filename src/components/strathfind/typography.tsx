import type { PropsWithChildren } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { type as typeScale } from '@/constants/design';
import { useAppTheme } from '@/theme/app-theme';

export type AppTextVariant = keyof typeof typeScale;

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function AppText({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...props
}: PropsWithChildren<AppTextProps>) {
  const { colors } = useAppTheme();

  return (
    <Text
      {...props}
      style={[typeScale[variant], { color: color ?? colors.ink, textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}
