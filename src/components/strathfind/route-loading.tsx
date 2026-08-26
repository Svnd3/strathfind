import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/design';
import { useAppTheme } from '@/theme/app-theme';

import { Screen } from './layout';
import { AppText } from './typography';

export function RouteLoadingScreen({ label = 'Checking access' }: { label?: string }) {
  const { colors } = useAppTheme();

  return (
    <Screen
      backgroundColor={colors.canvas}
      contentContainerStyle={styles.screen}
      edges={['top', 'right', 'bottom', 'left']}
      scrollable={false}
    >
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <ActivityIndicator accessibilityLabel={label} color={colors.wine} size="small" />
        <AppText color={colors.muted} variant="support">{label}</AppText>
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
