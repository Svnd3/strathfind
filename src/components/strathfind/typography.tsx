import type { PropsWithChildren } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { type as typeScale } from '@/constants/design';
import { useAppTheme } from '@/theme/app-theme';

export type AppTextVariant = keyof typeof typeScale;

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  'aria-level'?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function AppText({
  variant = 'body',
  color,
  align,
  style,
  children,
  'aria-level': ariaLevel,
  ...props
}: PropsWithChildren<AppTextProps>) {
  const { colors } = useAppTheme();
  const inferredHeadingLevel = props.accessibilityRole === 'header'
    ? variant === 'h1'
      ? 1
      : variant === 'h2'
        ? 2
        : 3
    : undefined;
  const webHeadingProps = Platform.OS === 'web' && (ariaLevel ?? inferredHeadingLevel)
    ? { 'aria-level': ariaLevel ?? inferredHeadingLevel }
    : {};

  return (
    <Text
      {...props}
      {...webHeadingProps}
      style={[typeScale[variant], { color: color ?? colors.ink, textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}
