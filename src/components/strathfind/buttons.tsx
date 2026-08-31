import { useState, type ComponentType, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import { focusRing, hoverShadow, layout, radius, spacing } from '@/constants/design';
import { useAppTheme } from '@/theme/app-theme';

import { AppText } from './typography';

type ButtonTone = 'primary' | 'secondary' | 'text';
type IconComponent = ComponentType<LucideProps>;

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  loading?: boolean;
  danger?: boolean;
  icon?: IconComponent;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

function Button({
  tone,
  loading = false,
  danger = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  accessibilityState,
  children,
  ...props
}: PropsWithChildren<ButtonProps & { tone: ButtonTone }>) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inactive = disabled || loading;
  const foreground = tone === 'primary' ? colors.onPrimary : danger ? colors.danger : colors.wine;

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: inactive, busy: loading }}
      disabled={inactive}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        {
          minHeight: layout.touchTarget,
          paddingHorizontal: tone === 'text' ? spacing.sm : spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderWidth: tone === 'text' ? 0 : 1,
          borderColor: tone === 'secondary' ? (danger ? colors.danger : colors.wine) : 'transparent',
          backgroundColor:
            tone === 'primary'
              ? pressed
                ? colors.primaryPressed
                : hovered
                  ? colors.primaryHover
                  : colors.primary
              : tone === 'secondary'
                ? pressed || hovered
                  ? danger ? colors.dangerSoft : colors.wineSoft
                  : colors.surfaceStrong
                : pressed || hovered
                  ? danger ? colors.dangerSoft : colors.wineSoft
                  : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          flexShrink: 0,
          maxWidth: '100%',
          opacity: inactive ? 0.48 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          ...hoverShadow(hovered && !inactive, colors.black),
          ...(Platform.OS === 'web' ? ({ cursor: inactive ? 'not-allowed' : 'pointer' } as ViewStyle) : {}),
        },
        focusRing(focused, tone === 'primary' ? colors.yellow : danger ? colors.danger : colors.wine),
        style,
      ]}
    >
      <View
        style={{
          maxWidth: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
        }}
      >
        {loading ? <ActivityIndicator color={foreground} size="small" /> : null}
        {!loading && Icon && iconPosition === 'left' ? <Icon color={foreground} size={20} strokeWidth={2.2} /> : null}
        <AppText
          align="center"
          variant="bodyStrong"
          color={foreground}
          style={[{ flexShrink: 1 }, textStyle]}
        >
          {children}
        </AppText>
        {!loading && Icon && iconPosition === 'right' ? <Icon color={foreground} size={20} strokeWidth={2.2} /> : null}
      </View>
    </Pressable>
  );
}

export function PrimaryButton(props: PropsWithChildren<ButtonProps>) {
  return <Button {...props} tone="primary" />;
}

export function SecondaryButton(props: PropsWithChildren<ButtonProps>) {
  return <Button {...props} tone="secondary" />;
}

export function TextButton(props: PropsWithChildren<ButtonProps>) {
  return <Button {...props} tone="text" />;
}

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: IconComponent;
  accessibilityLabel: string;
  selected?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  selected = false,
  size = 20,
  disabled,
  style,
  ...props
}: IconButtonProps) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={disabled}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        {
          width: layout.touchTarget,
          height: layout.touchTarget,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected || pressed || hovered ? colors.wineSoft : colors.surfaceStrong,
          borderWidth: 1,
          borderColor: selected ? colors.wine : colors.lineSoft,
          opacity: disabled ? 0.45 : 1,
          ...hoverShadow(hovered && !disabled, colors.black),
          ...(Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle) : {}),
        },
        focusRing(focused, colors.wine),
        style,
      ]}
    >
      <Icon color={selected ? colors.wine : colors.ink} size={size} strokeWidth={2.2} />
    </Pressable>
  );
}
