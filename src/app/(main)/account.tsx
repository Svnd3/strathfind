import { router } from 'expo-router';
import {
  BellRing,
  ChevronRight,
  FileText,
  Fingerprint,
  HelpCircle,
  LogIn,
  LogOut,
  LayoutDashboard,
  Moon,
  Settings2,
  ShieldCheck,
  Sun,
  UserPlus,
} from 'lucide-react-native';
import { useEffect, useState, type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import {
  AppText,
  BrandLockup,
  ContentShell,
  PrimaryButton,
  Screen,
  SecondaryButton,
  StatusPill,
  Surface,
  WideSwitch,
} from '@/components/strathfind';
import { focusRing, hoverShadow, radius, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

export default function AccountScreen() {
  const { isAuthenticated, mode, role, signOut, user } = useAppState();
  const { colors, isDark, setDarkMode } = useAppTheme();
  const [hapticFeedback, setHapticFeedback] = useState(true);

  useEffect(() => {
    void haptics.isEnabled().then(setHapticFeedback);
  }, []);

  const updateHaptics = (value: boolean) => {
    setHapticFeedback(value);
    void haptics.setEnabled(value);
    if (value) void haptics.select();
  };

  const leave = async () => {
    await signOut();
    router.replace('/');
  };

  const initials = user?.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'SF';

  return (
    <Screen backgroundColor={colors.canvas} edges={['top', 'left', 'right']}>
      <ContentShell maxWidth={820} style={styles.shell}>
        <View style={styles.topbar}>
          <BrandLockup markSize={40} />
          {isAuthenticated ? <StatusPill label="Verified" tone="success" /> : null}
        </View>

        <View style={styles.pageHeading}>
          <AppText accessibilityRole="header" color={colors.ink} variant="h1">Account</AppText>
          <AppText color={colors.muted} variant="support">Profile, privacy and preferences.</AppText>
        </View>

        {isAuthenticated ? (
          <Surface
            padding="lg"
            style={[
              styles.profileCard,
              { backgroundColor: colors.surface, borderColor: colors.lineSoft },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <AppText color={colors.onPrimary} variant="h2">{initials}</AppText>
            </View>
            <View style={styles.profileCopy}>
              <AppText color={colors.ink} variant="h3">{user?.name}</AppText>
              <AppText color={colors.muted} numberOfLines={1} variant="support">{user?.email}</AppText>
              <AppText color={colors.success} variant="support">
                {role === 'admin' ? 'Administrator' : `Student #${user?.campusId}`}
              </AppText>
            </View>
          </Surface>
        ) : (
          <Surface
            padding="lg"
            style={[
              styles.signInCard,
              { backgroundColor: colors.surface, borderColor: colors.lineSoft },
            ]}
          >
            <View style={[styles.signInIcon, { backgroundColor: colors.wineSoft }]}>
              <Fingerprint color={colors.wine} size={28} />
            </View>
            <View style={{ gap: spacing.xs }}>
              <AppText color={colors.ink} variant="h3">Your secure space</AppText>
              <AppText color={colors.muted} variant="support">
                Sign in to publish, claim and see full item details.
              </AppText>
            </View>
            {mode === 'setup' ? (
              <View style={[styles.setupNote, { backgroundColor: colors.warningSoft }]}>
                <ShieldCheck color={colors.warning} size={18} />
                <AppText color={colors.warning} style={{ flex: 1 }} variant="support">
                  Accounts activate when the secure database is connected.
                </AppText>
              </View>
            ) : null}
            <View style={styles.authActions}>
              <PrimaryButton
                icon={LogIn}
                onPress={() => router.push({ pathname: '/auth', params: { mode: 'sign-in' } })}
              >
                Sign in
              </PrimaryButton>
              <SecondaryButton
                icon={UserPlus}
                onPress={() => router.push({ pathname: '/auth', params: { mode: 'sign-up' } })}
              >
                Create account
              </SecondaryButton>
            </View>
          </Surface>
        )}

        {isAuthenticated ? (
          <View style={styles.section}>
            <AppText color={colors.muted} variant="micro">YOUR STUFF</AppText>
            <Surface
              padding={0}
              style={{ backgroundColor: colors.surfaceStrong, borderColor: colors.lineSoft }}
              tone="strong"
            >
              {role === 'admin' ? (
                <MenuRow
                  icon={LayoutDashboard}
                  label="Admin dashboard"
                  onPress={() => router.push('/admin')}
                />
              ) : (
                <MenuRow
                  icon={BellRing}
                  label="Activity"
                  onPress={() => router.push('/activity')}
                />
              )}
            </Surface>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionLabel}>
            <Settings2 color={colors.muted} size={17} />
            <AppText color={colors.muted} variant="micro">SETTINGS</AppText>
          </View>
          <Surface
            padding={0}
            style={{ backgroundColor: colors.surfaceStrong, borderColor: colors.lineSoft }}
            tone="strong"
          >
            <View style={styles.settingRow}>
              <View style={[styles.rowIcon, { backgroundColor: colors.wineSoft }]}>
                {isDark
                  ? <Moon color={colors.wine} size={20} />
                  : <Sun color={colors.wine} size={20} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText color={colors.ink} variant="bodyStrong">Dark mode</AppText>
                <AppText color={colors.muted} variant="support">
                  {isDark ? 'Dark appearance' : 'Light appearance'}
                </AppText>
              </View>
              <WideSwitch
                accessibilityHint="Switch between light and dark appearance"
                accessibilityLabel="Dark mode"
                hitSlop={8}
                ios_backgroundColor={colors.line}
                onValueChange={setDarkMode}
                thumbColor={colors.white}
                trackColor={{ false: colors.line, true: colors.primary }}
                value={isDark}
              />
            </View>
            <Divider />
            <View style={styles.settingRow}>
              <View style={[styles.rowIcon, { backgroundColor: colors.wineSoft }]}>
                <Fingerprint color={colors.wine} size={20} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText color={colors.ink} variant="bodyStrong">Haptic feedback</AppText>
                <AppText color={colors.muted} variant="support">Gentle tap cues</AppText>
              </View>
              <WideSwitch
                accessibilityLabel="Haptic feedback"
                hitSlop={8}
                ios_backgroundColor={colors.line}
                onValueChange={updateHaptics}
                thumbColor={colors.white}
                trackColor={{ false: colors.line, true: colors.primary }}
                value={hapticFeedback}
              />
            </View>
            <Divider />
            <MenuRow icon={FileText} label="Terms & privacy" onPress={() => router.push('/legal')} />
            <Divider />
            <MenuRow icon={HelpCircle} label="How StrathFind works" onPress={() => router.push('/?help=1')} />
          </Surface>
        </View>

        {isAuthenticated ? (
          <SecondaryButton
            icon={LogOut}
            onPress={() => void leave()}
            style={[styles.signOut, { borderColor: colors.danger }]}
          >
            Sign out
          </SecondaryButton>
        ) : null}
      </ContentShell>
    </Screen>
  );
}

function Divider() {
  const { colors } = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: colors.lineSoft }]} />;
}

function MenuRow({
  icon: Icon,
  label,
  onPress,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.settingRow,
        { backgroundColor: pressed ? colors.inset : 'transparent' },
        hoverShadow(hovered, colors.black),
        focusRing(focused, colors.wine),
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.wineSoft }]}>
        <Icon color={colors.wine} size={20} />
      </View>
      <AppText color={colors.ink} style={{ flex: 1 }} variant="bodyStrong">{label}</AppText>
      <ChevronRight aria-hidden color={colors.muted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  topbar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pageHeading: { gap: spacing.xxs },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  profileCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  signInCard: { gap: spacing.md },
  signInIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  setupNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  authActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  settingRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  divider: { height: 1, marginLeft: 68 },
  signOut: { alignSelf: 'stretch' },
});
