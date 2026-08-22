import { router } from 'expo-router';
import { Bell, Building2, Clock3, LockKeyhole, LogOut, Smartphone } from 'lucide-react-native';
import { useEffect, useState, type ComponentType } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
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
} from '@/components/strathfind';
import { palette, radius, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { useAppState } from '@/state';

export default function ProfileScreen() {
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
          <StatusPill label={mode === 'demo' ? 'Preview mode' : 'Connected'} tone={mode === 'demo' ? 'warning' : 'success'} />
        </View>

        <Surface padding="lg" style={styles.profileCard}>
          <View style={styles.avatar}>
            <AppText color={palette.yellow} variant="h2">{initials}</AppText>
          </View>
          <View style={styles.profileCopy}>
            <AppText accessibilityRole="header" variant="h2">{user?.name ?? 'Student'}</AppText>
            <AppText color={palette.muted} variant="body">{user?.email}</AppText>
            <View style={styles.verifiedRow}>
              <LockKeyhole color={palette.success} size={16} />
              <AppText color={palette.success} variant="support">Verified student · {user?.campusId}</AppText>
            </View>
          </View>
        </Surface>

        <SectionHeading description="Useful updates only. You stay in control." level={3} title="Notifications" />
        <Surface padding={0} tone="strong">
          <InfoRow
            copy="Possible matches appear in Activity"
            icon={Bell}
            label="Match suggestions"
          />
          <Divider />
          <InfoRow
            copy="Final-hour and handoff-due reminders"
            icon={Clock3}
            label="Handoff reminders"
          />
          <Divider />
          <SettingRow
            copy="Subtle confirmation on important actions"
            icon={Smartphone}
            label="Haptic feedback"
            onValueChange={updateHaptics}
            value={hapticFeedback}
          />
        </Surface>

        <SectionHeading description="Where unclaimed items are held." level={3} title="Campus lost & found" />
        <Surface padding="lg" tone="inset" style={styles.officeCard}>
          <View style={styles.officeIcon}><Building2 color={palette.wine} size={24} /></View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong">Student Centre desk</AppText>
            <AppText color={palette.muted} variant="support">Monday–Friday · 8:00–17:00</AppText>
            <AppText color={palette.muted} variant="support">Main gate security receives items after hours.</AppText>
          </View>
        </Surface>

        <SectionHeading level={3} title="Privacy & safety" />
        <Surface padding="lg" tone="inset" style={styles.officeCard}>
          <View style={styles.officeIcon}><LockKeyhole color={palette.wine} size={24} /></View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong">Contact stays protected</AppText>
            <AppText color={palette.muted} variant="support">Your number is revealed only after you approve an ownership claim. Every reveal is logged.</AppText>
          </View>
        </Surface>

        <PrimaryButton icon={LogOut} onPress={() => void leave()} style={styles.signOut}>
          Sign out
        </PrimaryButton>
        <AppText align="center" color={palette.muted} variant="micro">STRATHFIND 1.0 · SAFER RETURNS</AppText>
      </ContentShell>
    </Screen>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}><Icon color={palette.wine} size={20} /></View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText color={palette.muted} variant="support">{copy}</AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        thumbColor={palette.white}
        trackColor={{ false: palette.line, true: palette.wine }}
        value={value}
      />
    </View>
  );
}

function InfoRow({ copy, icon: Icon, label }: { copy: string; icon: ComponentType<LucideProps>; label: string }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}><Icon color={palette.wine} size={20} /></View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText color={palette.muted} variant="support">{copy}</AppText>
      </View>
      <StatusPill label="On" tone="success" />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { gap: spacing.lg, paddingTop: spacing.md },
  topbar: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: palette.wine },
  profileCopy: { flex: 1, gap: spacing.xxs },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  settingRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  settingIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.wineSoft },
  divider: { height: 1, marginLeft: 68, backgroundColor: palette.lineSoft },
  officeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  officeIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.surfaceStrong },
  signOut: { alignSelf: 'stretch', backgroundColor: palette.ink },
});
