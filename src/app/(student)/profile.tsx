import { router } from 'expo-router';
import { Bell, Building2, Clock3, LockKeyhole, LogOut, Smartphone } from 'lucide-react-native';
import { useEffect, useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import {
  AppText,
  BrandLockup,
  ContentShell,
  PrimaryButton,
  Screen,
  SectionHeading,
  StatusPill,
  Surface,
  WideSwitch,
} from '@/components/strathfind';
import { radius, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { mode, signOut, user } = useAppState();
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
    .toUpperCase() ?? 'SF';

  return (
    <Screen>
      <ContentShell maxWidth={820} style={styles.shell}>
        <View style={styles.topbar}>
          <BrandLockup markSize={40} />
          <StatusPill label={mode === 'setup' ? 'Setup needed' : 'Connected'} tone={mode === 'setup' ? 'warning' : 'success'} />
        </View>

        <Surface padding="lg" style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <AppText color={colors.onPrimary} variant="h2">{initials}</AppText>
          </View>
          <View style={styles.profileCopy}>
            <AppText accessibilityRole="header" variant="h2">{user?.name ?? 'Student'}</AppText>
            <AppText color={colors.muted} variant="body">{user?.email}</AppText>
            <View style={styles.verifiedRow}>
              <LockKeyhole color={colors.success} size={16} />
              <AppText color={colors.success} variant="support">Verified student · {user?.campusId}</AppText>
            </View>
          </View>
        </Surface>

        <SectionHeading level={3} title="Notifications" />
        <Surface padding={0} tone="strong">
          <InfoRow
            copy="Activity alerts"
            icon={Bell}
            label="Match suggestions"
          />
          <Divider />
          <InfoRow
            copy="Due-time alerts"
            icon={Clock3}
            label="Handoff reminders"
          />
          <Divider />
          <SettingRow
            copy="On key actions"
            icon={Smartphone}
            label="Haptic feedback"
            onValueChange={updateHaptics}
            value={hapticFeedback}
          />
        </Surface>

        <SectionHeading level={3} title="Campus lost & found" />
        <Surface padding="lg" tone="inset" style={styles.officeCard}>
          <View style={[styles.officeIcon, { backgroundColor: colors.surfaceStrong }]}>
            <Building2 color={colors.wine} size={24} />
          </View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong">Student Centre desk</AppText>
            <AppText color={colors.muted} variant="support">Mon–Fri · 8:00–17:00</AppText>
          </View>
        </Surface>

        <SectionHeading level={3} title="Privacy & safety" />
        <Surface padding="lg" tone="inset" style={styles.officeCard}>
          <View style={[styles.officeIcon, { backgroundColor: colors.surfaceStrong }]}>
            <LockKeyhole color={colors.wine} size={24} />
          </View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong">Contact stays protected</AppText>
            <AppText color={colors.muted} variant="support">Visible only after you approve a claim.</AppText>
          </View>
        </Surface>

        <PrimaryButton
          icon={LogOut}
          onPress={() => void leave()}
          style={[styles.signOut, { backgroundColor: colors.black }]}
        >
          Sign out
        </PrimaryButton>
      </ContentShell>
    </Screen>
  );
}

function Divider() {
  const { colors } = useAppTheme();
  return <View style={[styles.divider, { backgroundColor: colors.lineSoft }]} />;
}

function SettingRow({
  copy,
  icon: Icon,
  label,
  onValueChange,
  value,
}: {
  copy: string;
  icon: ComponentType<LucideProps>;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: colors.wineSoft }]}>
        <Icon color={colors.wine} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText color={colors.muted} variant="support">{copy}</AppText>
      </View>
      <WideSwitch
        accessibilityLabel={label}
        hitSlop={8}
        onValueChange={onValueChange}
        thumbColor={colors.white}
        trackColor={{ false: colors.line, true: colors.wine }}
        value={value}
      />
    </View>
  );
}

function InfoRow({ copy, icon: Icon, label }: { copy: string; icon: ComponentType<LucideProps>; label: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: colors.wineSoft }]}>
        <Icon color={colors.wine} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText color={colors.muted} variant="support">{copy}</AppText>
      </View>
      <StatusPill label="On" tone="success" />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: spacing.lg, paddingTop: spacing.md },
  topbar: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg },
  profileCopy: { flex: 1, gap: spacing.xxs },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  settingRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  settingIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  divider: { height: 1, marginLeft: 68 },
  officeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  officeIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  signOut: { alignSelf: 'stretch' },
});
