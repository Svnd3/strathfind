import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { palette, spacing } from '@/constants/design';

import { Screen } from './layout';
import { AppText } from './typography';

export function RouteLoadingScreen({ label = 'Checking access' }: { label?: string }) {
  return (
    <Screen
      backgroundColor={palette.canvas}
      contentContainerStyle={styles.screen}
      edges={['top', 'right', 'bottom', 'left']}
      scrollable={false}
    >
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <ActivityIndicator accessibilityLabel={label} color={palette.wine} size="small" />
        <AppText color={palette.muted} variant="support">{label}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
