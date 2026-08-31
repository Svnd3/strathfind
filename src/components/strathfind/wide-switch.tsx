import {
  type ColorValue,
  Platform,
  StyleSheet,
  Switch,
  View,
  type SwitchProps,
  type ViewStyle,
} from 'react-native';

/** A roomier switch that keeps a dependable 48px interaction target. */
export function WideSwitch({ hitSlop = 8, style, ...props }: SwitchProps) {
  const webProps = Platform.OS === 'web'
    ? ({ activeThumbColor: props.thumbColor } as { activeThumbColor?: ColorValue })
    : {};

  return (
    <View style={styles.slot}>
      <Switch {...props} {...webProps} hitSlop={hitSlop} style={[styles.switch, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 72,
    minHeight: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switch: Platform.select<ViewStyle>({
    web: { width: 62, height: 32 },
    ios: { transform: [{ scaleX: 1.18 }, { scaleY: 1.06 }] },
    android: { transform: [{ scaleX: 1.35 }, { scaleY: 1.08 }] },
    default: { transform: [{ scaleX: 1.2 }, { scaleY: 1.06 }] },
  }),
});
