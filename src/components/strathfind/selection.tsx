import { useState } from 'react';
import {
  Platform,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Check } from 'lucide-react-native';

import { focusRing, layout, radius, spacing } from '@/constants/design';
import { useAppTheme } from '@/theme/app-theme';

import { AppText } from './typography';

export interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
  style,
  accessibilityLabel,
}: ChipProps) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: layout.touchTarget,
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.lineSoft,
          backgroundColor: selected
            ? colors.primary
            : hovered || pressed
              ? colors.wineSoft
              : colors.surfaceStrong,
          opacity: disabled ? 0.45 : 1,
          ...(Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle) : {}),
        },
        focusRing(focused, selected ? colors.yellow : colors.wine),
        style,
      ]}
    >
      <AppText variant="support" color={selected ? colors.onPrimary : colors.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

interface SegmentButtonProps<T extends string> {
  option: SegmentOption<T>;
  selected: boolean;
  onChange: (value: T) => void;
}

function SegmentButton<T extends string>({ option, selected, onChange }: SegmentButtonProps<T>) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => onChange(option.value)}
      style={({ pressed }) => [
        {
          flexBasis: 88,
          flexGrow: 1,
          minWidth: 0,
          minHeight: layout.touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.sm,
          borderRadius: radius.sm,
          backgroundColor: selected
            ? pressed || hovered
              ? colors.primaryHover
              : colors.primary
            : pressed || hovered
              ? colors.wineSoft
              : colors.surfaceStrong,
          borderColor: selected ? colors.primaryPressed : colors.line,
          borderWidth: selected ? 2 : 1,
          ...(Platform.OS === 'web'
            ? ({
                cursor: 'pointer',
                boxShadow: focused
                  ? `0 0 0 2px ${colors.surfaceStrong}, 0 0 0 4px ${colors.wine}`
                  : 'none',
              } as ViewStyle)
            : focused
              ? { borderColor: colors.yellow, borderWidth: 3 }
              : {}),
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs }}>
        <View
          accessibilityElementsHidden={!selected}
          importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}
          style={{ width: 16, height: 16, opacity: selected ? 1 : 0 }}
        >
          <Check aria-hidden color={colors.onPrimary} size={16} strokeWidth={3} />
        </View>
        <AppText
          align="center"
          numberOfLines={2}
          variant="support"
          color={selected ? colors.onPrimary : colors.ink}
          style={{ flexShrink: 1 }}
        >
          {option.label}
        </AppText>
      </View>
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const { colors } = useAppTheme();

  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={[{ gap: spacing.xs }, style]}>
      <AppText variant="support">{label}</AppText>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          padding: spacing.xxs,
          borderRadius: radius.md,
          backgroundColor: colors.inset,
          borderColor: colors.line,
          borderWidth: 1,
        }}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <SegmentButton
              key={option.value}
              onChange={onChange}
              option={option}
              selected={selected}
            />
          );
        })}
      </View>
    </View>
  );
}
