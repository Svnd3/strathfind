import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/strathfind';
import { radius, raisedShadow, spacing, type AppPalette } from '@/constants/design';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

function getToneStyles(colors: AppPalette) {
  return {
    success: { background: colors.success, foreground: colors.onSuccess, icon: CheckCircle2 },
    warning: { background: colors.warning, foreground: colors.onWarning, icon: TriangleAlert },
    error: { background: colors.danger, foreground: colors.onDanger, icon: CircleAlert },
    info: { background: colors.blue, foreground: colors.onInfo, icon: Info },
  };
}

export function AppToast() {
  const { colors } = useAppTheme();
  const { toast, dismissToast } = useAppState();
  if (!toast) return null;

  const config = getToneStyles(colors)[toast.tone];
  const Icon = config.icon;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: config.background, ...raisedShadow('md', colors.black) }]}
      >
        <Icon color={config.foreground} size={20} />
        <AppText color={config.foreground} variant="support" style={styles.message}>
          {toast.message}
        </AppText>
        <Pressable
          accessibilityLabel="Dismiss message"
          accessibilityRole="button"
          hitSlop={8}
          onPress={dismissToast}
          style={styles.close}
        >
          <X color={config.foreground} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    right: 0,
    bottom: Platform.OS === 'web' ? 24 : 96,
    left: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  toast: {
    width: '100%',
    maxWidth: 520,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
  },
  message: { flex: 1 },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
