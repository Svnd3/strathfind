import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/strathfind';
import { palette, radius, raisedShadow, spacing } from '@/constants/design';
import { useAppState } from '@/state';

const toneStyles = {
  success: { background: palette.success, icon: CheckCircle2 },
  warning: { background: palette.warning, icon: TriangleAlert },
  error: { background: palette.danger, icon: CircleAlert },
  info: { background: palette.ink, icon: Info },
};

export function AppToast() {
  const { toast, dismissToast } = useAppState();
  if (!toast) return null;

  const config = toneStyles[toast.tone];
  const Icon = config.icon;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: config.background }]}
      >
        <Icon color={palette.white} size={20} />
        <AppText color={palette.white} variant="support" style={styles.message}>
          {toast.message}
        </AppText>
        <Pressable
          accessibilityLabel="Dismiss message"
          accessibilityRole="button"
          hitSlop={8}
          onPress={dismissToast}
          style={styles.close}
        >
          <X color={palette.white} size={18} />
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
    ...raisedShadow('md'),
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
