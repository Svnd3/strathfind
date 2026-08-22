import type { PropsWithChildren } from 'react';
import {
  ScrollView,
  useWindowDimensions,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { layout, palette, spacing } from '@/constants/design';

export interface ContentShellProps {
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export function ContentShell({
  maxWidth = layout.appMax,
  style,
  children,
}: PropsWithChildren<ContentShellProps>) {
  const { width } = useWindowDimensions();
  const gutter = width < 640 ? layout.mobileGutter : layout.gutter;

  return (
    <View
      style={[
        {
          width: '100%',
          maxWidth,
          alignSelf: 'center',
          paddingHorizontal: gutter,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface ScreenProps extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  scrollable?: boolean;
  edges?: Edge[];
  contentContainerStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

export function Screen({
  scrollable = true,
  edges = ['top', 'left', 'right'],
  contentContainerStyle,
  backgroundColor = palette.canvas,
  children,
  ...scrollProps
}: PropsWithChildren<ScreenProps>) {
  if (!scrollable) {
    return (
      <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor }}>
        <View nativeID="main-content" role="main" style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nativeID="main-content"
        role="main"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
        contentContainerStyle={[
          { flexGrow: 1, paddingBottom: spacing.xxl },
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
