import type { ComponentType, ReactNode } from 'react';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { SearchX, type LucideProps } from 'lucide-react-native';

import { layout, palette, radius, spacing } from '@/constants/design';

import type { ButtonProps } from './buttons';
import { PrimaryButton, TextButton } from './buttons';
import { AppText } from './typography';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ComponentType<LucideProps>;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  message,
  icon: Icon = SearchX,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View
      accessibilityRole="summary"
      style={[
        {
          alignItems: 'center',
          alignSelf: 'center',
          width: '100%',
          maxWidth: layout.readingMax,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xxl,
          gap: spacing.md,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 72,
          height: 72,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.pill,
          backgroundColor: palette.wineSoft,
        }}
      >
        <Icon aria-hidden color={palette.wine} size={32} strokeWidth={1.8} />
      </View>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <AppText variant="h3" align="center">
          {title}
        </AppText>
        {message ? (
          <AppText variant="body" color={palette.muted} align="center">
            {message}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <PrimaryButton onPress={onAction} style={{ alignSelf: 'center' }}>{actionLabel}</PrimaryButton>
      ) : null}
    </View>
  );
}

export interface SectionHeadingProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionProps?: Omit<ButtonProps, 'children'>;
  trailing?: ReactNode;
  level?: 1 | 2 | 3;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeading({
  title,
  description,
  eyebrow,
  actionLabel,
  onAction,
  actionProps,
  trailing,
  level = 2,
  style,
}: SectionHeadingProps) {
  const { width } = useWindowDimensions();
  const variant = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
  const hasAction = Boolean(trailing || (actionLabel && onAction));
  const stack = hasAction && width < 480;

  return (
    <View
      style={[
        {
          flexDirection: stack ? 'column' : 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, maxWidth: layout.readingMax, gap: spacing.xs }}>
        {eyebrow ? (
          <AppText variant="micro" color={palette.wine}>
            {eyebrow.toUpperCase()}
          </AppText>
        ) : null}
        <AppText accessibilityRole="header" variant={variant}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="body" color={palette.muted}>
            {description}
          </AppText>
        ) : null}
      </View>
      {trailing ??
        (actionLabel && onAction ? (
          <TextButton {...actionProps} fullWidth={stack} onPress={onAction}>
            {actionLabel}
          </TextButton>
        ) : null)}
    </View>
  );
}
