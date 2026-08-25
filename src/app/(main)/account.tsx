import { router } from 'expo-router';
import {
  BellRing,
  ChevronRight,
  FileText,
  Fingerprint,
  HelpCircle,
  LogIn,
  LogOut,
  Settings2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react-native';
import { useEffect, useState, type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View, type ViewStyle } from 'react-native';
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
} from '@/components/strathfind';
import { focusRing, palette, radius, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { useAppState } from '@/state';

export default function AccountScreen() {
  const { isAuthenticated, mode, signOut, user } = useAppState();
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
    <Screen edges={['top', 'left', 'right']}>
      <ContentShell maxWidth={820} style={styles.shell}>
        <View style={styles.topbar}>
          <BrandLockup markSize={40} />
          {isAuthenticated ? <StatusPill label="Verified" tone="success" /> : null}
        </View>

        <View style={styles.pageHeading}>
          <AppText accessibilityRole="header" variant="h1">Account</AppText>
          <AppText color={palette.muted} variant="support">Profile, privacy and preferences.</AppText>
        </View>

        {isAuthenticated ? (
          <Surface padding="lg" style={styles.profileCard}>
            <View style={styles.avatar}>
              <AppText color={palette.yellow} variant="h2">{initials}</AppText>
            </View>
            <View style={styles.profileCopy}>
              <AppText variant="h3">{user?.name}</AppText>
              <AppText color={palette.muted} numberOfLines={1} variant="support">{user?.email}</AppText>
              <AppText color={palette.success} variant="support">Student #{user?.campusId}</AppText>
            </View>
          </Surface>
        ) : (
          <Surface padding="lg" style={styles.signInCard}>
            <View style={styles.signInIcon}><Fingerprint color={palette.wine} size={28} /></View>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="h3">Your secure space</AppText>
              <AppText color={palette.muted} variant="support">
                Sign in to publish, claim and see full item details.
              </AppText>
            </View>
            {mode === 'setup' ? (
              <View style={styles.setupNote}>
                <ShieldCheck color={palette.warning} size={18} />
                <AppText color={palette.warning} style={{ flex: 1 }} variant="support">
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
            <AppText color={palette.muted} variant="micro">YOUR STUFF</AppText>
            <Surface padding={0} tone="strong">
              <MenuRow
                icon={BellRing}
                label="Activity"
                onPress={() => router.push('/activity')}
              />
            </Surface>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionLabel}>
            <Settings2 color={palette.muted} size={17} />
            <AppText color={palette.muted} variant="micro">SETTINGS</AppText>
          </View>
          <Surface padding={0} tone="strong">
            <View style={styles.settingRow}>
              <View style={styles.rowIcon}><Fingerprint color={palette.wine} size={20} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong">Haptic feedback</AppText>
                <AppText color={palette.muted} variant="support">Gentle tap cues</AppText>
              </View>
              <Switch
                accessibilityLabel="Haptic feedback"
                onValueChange={updateHaptics}
                thumbColor={palette.white}
                trackColor={{ false: palette.line, true: palette.wine }}
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
          <SecondaryButton icon={LogOut} onPress={() => void leave()} style={styles.signOut}>
            Sign out
          </SecondaryButton>
        ) : null}
      </ContentShell>
    </Screen>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { backgroundColor: pressed ? palette.inset : 'transparent' },
        focusRing(focused),
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
      ]}
    >
      <View style={styles.rowIcon}><Icon color={palette.wine} size={20} /></View>
      <AppText style={{ flex: 1 }} variant="bodyStrong">{label}</AppText>
      <ChevronRight aria-hidden color={palette.muted} size={20} />
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
    backgroundColor: palette.wine,
  },
  profileCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  signInCard: { gap: spacing.md },
  signInIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: palette.wineSoft,
  },
  setupNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.warningSoft,
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
    backgroundColor: palette.wineSoft,
  },
  divider: { height: 1, marginLeft: 68, backgroundColor: palette.lineSoft },
  signOut: { alignSelf: 'stretch', borderColor: palette.danger },
});
