import { forwardRef, useId, useState } from 'react';
import {
  Platform,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { layout, palette, radius, spacing, type as typeScale } from '@/constants/design';

import { AppText } from './typography';

export interface TextFieldProps extends TextInputProps {
  label: string;
  helpText?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    helpText,
    error,
    containerStyle,
    inputStyle,
    leading,
    trailing,
    onFocus,
    onBlur,
    editable = true,
    multiline = false,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const inputId = props.nativeID ?? `field-${generatedId}`;
  const supportId = `${inputId}-support`;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      <AppText nativeID={`${inputId}-label`} variant="support" color={palette.ink}>
        {label}
      </AppText>
      <View
        style={{
          minHeight: multiline ? 120 : layout.controlHeight,
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: multiline ? spacing.sm : 0,
          borderRadius: radius.md,
          borderWidth: focused ? 2 : 1,
          borderColor: error ? palette.danger : focused ? palette.wine : palette.line,
          backgroundColor: editable ? palette.surfaceStrong : palette.inset,
          opacity: editable ? 1 : 0.65,
        }}
      >
        {leading ? <View style={{ marginTop: multiline ? 2 : 0 }}>{leading}</View> : null}
        <TextInput
          {...props}
          ref={ref}
          nativeID={inputId}
          accessibilityLabel={label}
          accessibilityHint={error ?? helpText}
          aria-labelledby={`${inputId}-label`}
          aria-describedby={error || helpText ? supportId : undefined}
          aria-invalid={Boolean(error)}
          editable={editable}
          multiline={multiline}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={palette.muted}
          selectionColor={palette.wine}
          style={[
            typeScale.body,
            {
              flex: 1,
              minHeight: multiline ? 92 : layout.touchTarget,
              paddingVertical: multiline ? spacing.xs : 0,
              color: palette.ink,
              textAlignVertical: multiline ? 'top' : 'center',
              ...(Platform.OS === 'web'
                ? ({ outlineColor: 'transparent', outlineStyle: 'solid' } as TextStyle)
                : {}),
            },
            inputStyle,
          ]}
        />
        {trailing ? <View style={{ marginTop: multiline ? 2 : 0 }}>{trailing}</View> : null}
      </View>
      {error || helpText ? (
        <AppText
          nativeID={supportId}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          variant="support"
          color={error ? palette.danger : palette.muted}
        >
          {error ?? helpText}
        </AppText>
      ) : null}
    </View>
  );
});

export type TextAreaProps = Omit<TextFieldProps, 'multiline'>;

export const TextArea = forwardRef<TextInput, TextAreaProps>(function TextArea(props, ref) {
  return <TextField {...props} ref={ref} multiline />;
});
