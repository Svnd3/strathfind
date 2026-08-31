import { router, useLocalSearchParams } from 'expo-router';
import { HelpCircle, PackageCheck, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { AppText, BrandLockup, ContentShell, IconButton, Screen } from '@/components/strathfind';
import { focusRing, radius, raisedShadow, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme/app-theme';

export default function HomeScreen() {
  const params = useLocalSearchParams<{ help?: string }>();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusedAction, setFocusedAction] = useState<'lost' | 'found' | null>(null);
  const compact = width < 620;

  useEffect(() => {
    if (params.help !== '1') return;
    const timer = setTimeout(() => setHelpOpen(true), 0);
    return () => clearTimeout(timer);
  }, [params.help]);

  const go = (target: 'lost' | 'found') => {
    void haptics.press();
    router.push(target === 'lost' ? '/lost' : '/report-found');
  };

  return (
    <Screen backgroundColor={colors.canvas} edges={['top', 'left', 'right']}>
      <ContentShell maxWidth={1120} style={styles.shell}>
        <View style={styles.topbar}>
          <IconButton
            accessibilityLabel="How StrathFind works"
            icon={HelpCircle}
            onPress={() => setHelpOpen(true)}
          />
          <BrandLockup compact={compact} markSize={42} />
          <View aria-hidden style={styles.topbarSpacer} />
        </View>

        <View style={[styles.stage, compact && styles.stageCompact]}>
          <View style={[styles.actions, compact && styles.actionsCompact]}>
            <HomeAction
              compact={compact}
              focused={focusedAction === 'lost'}
              icon={Search}
              label="LOST?"
              onBlur={() => setFocusedAction(null)}
              onFocus={() => setFocusedAction('lost')}
              onPress={() => go('lost')}
              tone="lost"
            />
            <HomeAction
              compact={compact}
              focused={focusedAction === 'found'}
              icon={PackageCheck}
              label="FOUND?"
              onBlur={() => setFocusedAction(null)}
              onFocus={() => setFocusedAction('found')}
              onPress={() => go('found')}
              tone="found"
            />
          </View>
        </View>
      </ContentShell>

      <Modal
        animationType="fade"
        onRequestClose={() => setHelpOpen(false)}
        transparent
        visible={helpOpen}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.scrim }]}>
          <Pressable
            accessibilityLabel="Close help"
            accessibilityRole="button"
            onPress={() => setHelpOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.helpCard,
              {
                backgroundColor: colors.surfaceStrong,
                borderColor: colors.lineSoft,
                ...raisedShadow('lg', colors.black),
              },
            ]}
          >
            <View style={styles.helpHeading}>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <AppText accessibilityRole="header" color={colors.ink} variant="h2">Find it. Return it.</AppText>
                <AppText color={colors.muted} variant="support">Strathmore campus lost & found.</AppText>
              </View>
              <IconButton accessibilityLabel="Close help" icon={X} onPress={() => setHelpOpen(false)} />
            </View>
            <HelpRow index="1" text="LOST? opens missing-item reports." />
            <HelpRow index="2" text="FOUND? starts a secure found-item report." />
            <HelpRow index="3" text="Tap a card to preview it. Sign in for full details." />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function HomeAction({
  compact,
  focused,
  icon: Icon,
  label,
  onBlur,
  onFocus,
  onPress,
  tone,
}: {
  compact: boolean;
  focused: boolean;
  icon: typeof Search;
  label: string;
  onBlur: () => void;
  onFocus: () => void;
  onPress: () => void;
  tone: 'lost' | 'found';
}) {
  const { colors } = useAppTheme();
  const background = tone === 'lost' ? colors.cardRed : colors.cardGreen;
  const pressedBackground = tone === 'lost' ? colors.cardRedPressed : colors.cardGreenPressed;
  const foreground = tone === 'lost' ? colors.onCardRed : colors.onCardGreen;

  return (
    <Pressable
      accessibilityLabel={tone === 'lost' ? 'Browse lost items' : 'Report a found item'}
      accessibilityRole="button"
      onBlur={onBlur}
      onFocus={onFocus}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.action,
        compact && styles.actionCompact,
        {
          backgroundColor: pressed || hovered ? pressedBackground : background,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          ...raisedShadow(hovered ? 'lg' : 'md', colors.black),
          ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : {}),
        },
        focusRing(focused, foreground),
      ]}
    >
      <View style={[styles.actionIcon, compact && styles.actionIconCompact, { backgroundColor: colors.yellow }]}>
        <Icon aria-hidden color={colors.black} size={28} strokeWidth={2.4} />
      </View>
      <AppText color={foreground} style={[styles.actionLabel, compact && styles.actionLabelCompact]}>{label}</AppText>
    </Pressable>
  );
}

function HelpRow({ index, text }: { index: string; text: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.helpRow}>
      <View style={[styles.helpNumber, { backgroundColor: colors.wineSoft }]}>
        <AppText color={colors.wine} variant="support">{index}</AppText>
      </View>
      <AppText color={colors.ink} style={{ flex: 1 }} variant="body">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  topbar: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  topbarSpacer: { width: 48, height: 48 },
  stage: { flex: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  stageCompact: { paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: spacing.lg },
  actionsCompact: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm },
  action: {
    flex: 1,
    minWidth: 0,
    maxWidth: 500,
    minHeight: 280,
    justifyContent: 'space-between',
    padding: spacing.xl,
    borderRadius: 44,
  },
  actionCompact: {
    flex: 0,
    width: '100%',
    maxWidth: '100%',
    minHeight: 164,
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  actionIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  actionIconCompact: { width: 48, height: 48, borderRadius: radius.md },
  actionLabel: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  actionLabelCompact: { fontSize: 38, lineHeight: 42, letterSpacing: -1 },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  helpCard: {
    width: '100%',
    maxWidth: 480,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  helpHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  helpRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  helpNumber: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
});
