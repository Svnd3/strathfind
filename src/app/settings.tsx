import { router } from 'expo-router';
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  FileText,
  Fingerprint,
  HelpCircle,
  LogIn,
  LogOut,
  Palette,
  ShieldCheck,
  UserPlus,
} from 'lucide-react-native';
import { useEffect, useState, type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import {
  AppText,
  BrandLockup,
  ContentShell,
  IconButton,
  PrimaryButton,
  RouteLoadingScreen,
  Screen,
  SecondaryButton,
  SegmentedControl,
  Surface,
  WideSwitch,
} from '@/components/strathfind';
import { focusRing, hoverShadow, radius, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { useAppState } from '@/state';
import { useAppTheme, type ThemePreference } from '@/theme/app-theme';

const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
] as const;

export default function SettingsScreen() {
  const { isAuthenticated, loading, role, signOut, user } = useAppState();
  const { colors, preference, setPreference } = useAppTheme();
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const accountUser = isAuthenticated ? user : null;

  useEffect(() => {
    let active = true;
    void haptics.isEnabled().then((enabled) => {
      if (active) setHapticFeedback(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const updateTheme = (value: ThemePreference) => {
    setPreference(value);
    void haptics.select();
  };

  const updateHaptics = (value: boolean) => {
    setHapticFeedback(value);
    void haptics.setEnabled(value).then(() => {
      if (value) void haptics.select();
    });
  };

  const leave = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      await signOut();
      router.replace('/');
    } catch {
      setSignOutError('You could not be signed out. Try again.');
      setSigningOut(false);
    }
  };

  if (loading) return <RouteLoadingScreen label="Loading settings" />;

  return (
    <Screen backgroundColor={colors.canvas}>
      <ContentShell maxWidth={760} style={styles.shell}>
        <View style={styles.topbar}>
          <IconButton
            accessibilityHint="Returns to the previous screen"
            accessibilityLabel="Back"
            icon={ArrowLeft}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/account');
            }}
          />
          <BrandLockup markSize={38} />
          <View aria-hidden style={styles.topbarSpacer} />
        </View>

        <View style={styles.pageHeading}>
          <AppText accessibilityRole="header" aria-level={1} variant="h1">Settings</AppText>
          <AppText color={colors.muted} variant="support">
            Appearance, privacy and help in one place.
          </AppText>
        </View>

        <View style={styles.section}>
          <AppText accessibilityRole="header" aria-level={2} variant="h3">Appearance & feedback</AppText>
          <Surface padding="lg" style={styles.preferenceCard} tone="strong">
            <InfoRow
              description="Follow your device or choose the look you prefer."
              icon={Palette}
              title="Colour theme"
            />
            <SegmentedControl
              label="Choose colour theme"
              onChange={updateTheme}
              options={themeOptions}
              value={preference}
            />
            {Platform.OS !== 'web' ? (
              <>
                <Divider />
                <View style={styles.switchRow}>
                  <View style={[styles.rowIcon, { backgroundColor: colors.wineSoft }]}>
                    <Fingerprint aria-hidden color={colors.wine} size={21} />
                  </View>
                  <View style={styles.flexCopy}>
                    <AppText variant="bodyStrong">Haptic feedback</AppText>
                    <AppText color={colors.muted} variant="support">
                      Gentle tap cues for supported actions.
                    </AppText>
                  </View>
                  <WideSwitch
                    accessibilityHint="Turns touch feedback on or off"
                    accessibilityLabel="Haptic feedback"
                    hitSlop={8}
                    ios_backgroundColor={colors.line}
                    onValueChange={updateHaptics}
                    thumbColor={colors.white}
                    trackColor={{ false: colors.line, true: colors.primary }}
                    value={hapticFeedback}
                  />
                </View>
              </>
            ) : null}
          </Surface>
        </View>

        <View style={styles.section}>
          <AppText accessibilityRole="header" aria-level={2} variant="h3">Privacy & campus identity</AppText>
          <Surface padding={0} tone="strong">
            <InfoRow
              description="Your phone number and email are not shown on public listings. Contact details are shared only after a claim is approved."
              icon={ShieldCheck}
              padded
              title="Contact details stay private"
            />
            {accountUser ? (
              <>
                <Divider inset />
                <InfoRow
                  description={`${accountUser.university} · ${
                    role === 'admin' ? 'Administrator' : `Student #${accountUser.campusId}`
                  }\n${accountUser.email}`}
                  icon={BadgeCheck}
                  padded
                  title="Verified campus profile"
                />
              </>
            ) : null}
          </Surface>
        </View>

        <View style={styles.section}>
          <AppText accessibilityRole="header" aria-level={2} variant="h3">Support & policies</AppText>
          <Surface padding={0} tone="strong">
            <SettingsLink
              description="Read the rules for using StrathFind and how your data is handled."
              icon={FileText}
              label="Terms & privacy"
              onPress={() => router.push('/legal')}
            />
            <Divider inset />
            <SettingsLink
              description="Learn how reporting, claiming and safe return work."
              icon={HelpCircle}
              label="How StrathFind works"
              onPress={() => router.push('/?help=1')}
            />
          </Surface>
        </View>

        <View style={styles.section}>
          <AppText accessibilityRole="header" aria-level={2} variant="h3">Account</AppText>
          {accountUser ? (
            <Surface padding="lg" style={styles.accountCard} tone="flat">
              <View style={styles.cardCopy}>
                <AppText variant="bodyStrong">Signed in as {accountUser.email}</AppText>
                <AppText color={colors.muted} variant="support">
                  Signing out ends this session on the current device.
                </AppText>
              </View>
              <SecondaryButton
                danger
                fullWidth
                icon={LogOut}
                loading={signingOut}
                onPress={() => void leave()}
              >
                Sign out
              </SecondaryButton>
              {signOutError ? (
                <AppText
                  accessibilityLiveRegion="polite"
                  color={colors.danger}
                  variant="support"
                >
                  {signOutError}
                </AppText>
              ) : null}
            </Surface>
          ) : (
            <Surface padding="lg" style={styles.accountCard} tone="flat">
              <View style={styles.cardCopy}>
                <AppText variant="bodyStrong">You are browsing as a guest</AppText>
                <AppText color={colors.muted} variant="support">
                  Sign in to publish reports and see your activity, or create an account if you are new.
                </AppText>
              </View>
              <PrimaryButton
                fullWidth
                icon={LogIn}
                onPress={() => router.push({
                  pathname: '/auth',
                  params: { mode: 'sign-in', returnTo: '/account' },
                })}
              >
                Sign in
              </PrimaryButton>
              <SecondaryButton
                fullWidth
                icon={UserPlus}
                onPress={() => router.push({
                  pathname: '/auth',
                  params: { mode: 'sign-up', returnTo: '/account' },
                })}
              >
                Create account
              </SecondaryButton>
            </Surface>
          )}
        </View>
      </ContentShell>
    </Screen>
  );
}

function InfoRow({
  description,
  icon: Icon,
  padded = false,
  title,
}: {
  description: string;
  icon: ComponentType<LucideProps>;
  padded?: boolean;
  title: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityLabel={`${title}. ${description}`}
      accessible
      style={[styles.infoRow, padded && styles.paddedRow]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.wineSoft }]}>
        <Icon aria-hidden color={colors.wine} size={21} />
      </View>
      <View style={styles.flexCopy}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText color={colors.muted} variant="support">{description}</AppText>
      </View>
    </View>
  );
}

function SettingsLink({
  description,
  icon: Icon,
  label,
  onPress,
}: {
  description: string;
  icon: ComponentType<LucideProps>;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={label}
      accessibilityRole="button"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.linkRow,
        { backgroundColor: pressed ? colors.inset : 'transparent' },
        hoverShadow(hovered, colors.black),
        focusRing(focused, colors.wine),
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.wineSoft }]}>
        <Icon aria-hidden color={colors.wine} size={21} />
      </View>
      <View style={styles.flexCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText color={colors.muted} variant="support">{description}</AppText>
      </View>
      <ChevronRight aria-hidden color={colors.muted} size={20} />
    </Pressable>
  );
}

function Divider({ inset = false }: { inset?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View
      aria-hidden
      style={[
        styles.divider,
        inset && styles.insetDivider,
        { backgroundColor: colors.lineSoft },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  topbar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  topbarSpacer: { width: 48, height: 48 },
  pageHeading: { gap: spacing.xxs },
  section: { gap: spacing.sm },
  preferenceCard: { gap: spacing.lg },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  paddedRow: {
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  switchRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  rowIcon: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  flexCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  divider: { height: 1 },
  insetDivider: { marginLeft: 72 },
  accountCard: { gap: spacing.md },
  cardCopy: { gap: spacing.xs },
});
