import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import {
  BadgeCheck,
  BellRing,
  Camera,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Settings,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import {
  AppText,
  BrandLockup,
  ContentShell,
  EmptyState,
  IconButton,
  ItemCard,
  RouteLoadingScreen,
  Screen,
  SecondaryButton,
  SectionHeading,
  Surface,
  TextButton,
} from '@/components/strathfind';
import { focusRing, hoverShadow, radius, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

type ReportFilter = 'all' | 'lost' | 'found';
type PhotoAction = 'change' | 'remove' | null;

const reportFilters = [
  { label: 'All', value: 'all' },
  { label: 'Lost', value: 'lost' },
  { label: 'Found', value: 'found' },
] as const;

const supportedProfilePhotoTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export default function AccountScreen() {
  const {
    currentUserItems,
    isAuthenticated,
    role,
    updateProfilePhoto,
    user,
    loading,
  } = useAppState();
  const { colors } = useAppTheme();
  const { fontScale, width } = useWindowDimensions();
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');
  const [photoAction, setPhotoAction] = useState<PhotoAction>(null);
  const [photoError, setPhotoError] = useState('');
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const accountUser = isAuthenticated ? user : null;
  const compact = width < 520;
  const stackProfile = width < 300 || fontScale >= 1.3;
  const columns = width < 640 ? 2 : width < 1024 ? 3 : 4;
  const filteredItems = useMemo(
    () => currentUserItems.filter((item) => reportFilter === 'all' || item.kind === reportFilter),
    [currentUserItems, reportFilter],
  );
  const itemRows = useMemo(
    () => Array.from(
      { length: Math.ceil(filteredItems.length / columns) },
      (_, rowIndex) => filteredItems.slice(rowIndex * columns, rowIndex * columns + columns),
    ),
    [columns, filteredItems],
  );
  const lostCount = currentUserItems.filter((item) => item.kind === 'lost').length;
  const foundCount = currentUserItems.length - lostCount;
  const initials = accountUser?.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'SF';
  const avatarVisible = Boolean(
    accountUser?.avatarUrl && failedAvatarUrl !== accountUser.avatarUrl,
  );
  const hasStoredAvatar = Boolean(accountUser?.avatarPath);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const chooseProfilePhoto = async () => {
    if (!accountUser || photoAction) return;

    setPhotoAction('change');
    setPhotoError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError('Photo access is needed to choose a profile picture. You can allow it in device settings.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        setPhotoError('That photo could not be read. Choose another image.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        setPhotoError('Choose an image smaller than 5 MB.');
        return;
      }
      if (asset.mimeType && !supportedProfilePhotoTypes.has(asset.mimeType.toLowerCase())) {
        setPhotoError('Choose a JPEG, PNG, WebP or HEIC photo.');
        return;
      }

      const resultUpdate = await updateProfilePhoto(asset.uri);
      if (!resultUpdate.ok) setPhotoError(resultUpdate.error);
      else setFailedAvatarUrl(null);
    } catch {
      setPhotoError('Your profile photo could not be updated. Try again.');
    } finally {
      setPhotoAction(null);
    }
  };

  const removeProfilePhoto = async () => {
    if (!accountUser?.avatarPath || photoAction) return;

    setPhotoAction('remove');
    setPhotoError('');
    try {
      const result = await updateProfilePhoto(null);
      if (!result.ok) setPhotoError(result.error);
      else setFailedAvatarUrl(null);
    } catch {
      setPhotoError('Your profile photo could not be removed. Try again.');
    } finally {
      setPhotoAction(null);
    }
  };

  const selectReportFilter = (value: ReportFilter) => {
    setReportFilter(value);
    void haptics.select();
  };

  if (loading) return <RouteLoadingScreen label="Loading account" />;

  return (
    <Screen backgroundColor={colors.canvas} edges={['top', 'left', 'right']}>
      <ContentShell maxWidth={920} style={styles.shell}>
        <View style={styles.topbar}>
          <BrandLockup markSize={40} />
          <IconButton
            accessibilityHint="Opens appearance, privacy and support settings"
            accessibilityLabel="Open settings"
            icon={Settings}
            onPress={() => router.push('/settings' as Href)}
          />
        </View>

        <View style={[styles.profile, { borderBottomColor: colors.lineSoft }]}>
          <View style={[styles.profileOverview, stackProfile && styles.profileOverviewStacked]}>
            <View
              accessibilityLabel={accountUser ? `Profile picture for ${accountUser.name}` : 'Guest profile picture'}
              accessibilityRole="image"
              style={[
                styles.avatar,
                {
                  backgroundColor: accountUser ? colors.primary : colors.inset,
                  borderColor: colors.lineSoft,
                },
              ]}
            >
              {accountUser ? (
                <AppText
                  accessibilityElementsHidden
                  aria-hidden
                  color={colors.onPrimary}
                  variant="h2"
                >
                  {initials}
                </AppText>
              ) : (
                <UserRound aria-hidden color={colors.muted} size={42} strokeWidth={1.7} />
              )}
              {avatarVisible && accountUser?.avatarUrl ? (
                <Image
                  accessibilityElementsHidden
                  aria-hidden
                  contentFit="cover"
                  onError={() => setFailedAvatarUrl(accountUser.avatarUrl ?? null)}
                  source={{ uri: accountUser.avatarUrl }}
                  style={styles.avatarImage}
                  transition={120}
                />
              ) : null}
            </View>

            <View style={styles.profileStats}>
              <ProfileStat label="Reports" value={currentUserItems.length} />
              <ProfileStat label="Lost" value={lostCount} />
              <ProfileStat label="Found" value={foundCount} />
            </View>
          </View>

          <View style={styles.profileCopy}>
            <AppText accessibilityRole="header" aria-level={1} color={colors.ink} numberOfLines={2} variant="h1">
              {accountUser?.name ?? 'Guest'}
            </AppText>
            <AppText
              color={colors.muted}
              numberOfLines={accountUser ? 1 : undefined}
              variant="support"
            >
              {accountUser?.email ?? 'Sign in from Settings to start your profile.'}
            </AppText>
            {accountUser ? (
              <View style={styles.verifiedRow}>
                <BadgeCheck aria-hidden color={colors.success} size={18} strokeWidth={2.2} />
                <AppText color={colors.success} style={styles.verifiedText} variant="support">
                  {role === 'admin' ? 'Verified administrator' : `Verified student · #${accountUser.campusId}`}
                </AppText>
              </View>
            ) : null}
          </View>

          {accountUser ? (
            <View style={styles.photoActions}>
              <SecondaryButton
                disabled={Boolean(photoAction)}
                fullWidth={compact}
                icon={Camera}
                loading={photoAction === 'change'}
                onPress={() => void chooseProfilePhoto()}
              >
                {hasStoredAvatar ? 'Change photo' : 'Add photo'}
              </SecondaryButton>
              {hasStoredAvatar ? (
                <TextButton
                  disabled={Boolean(photoAction)}
                  fullWidth={compact}
                  icon={Trash2}
                  loading={photoAction === 'remove'}
                  onPress={() => void removeProfilePhoto()}
                >
                  Remove photo
                </TextButton>
              ) : null}
            </View>
          ) : null}
          {photoError ? (
            <AppText accessibilityLiveRegion="polite" color={colors.danger} variant="support">
              {photoError}
            </AppText>
          ) : null}
        </View>

        <View style={styles.reportsSection}>
          <SectionHeading
            description={
              accountUser
                ? currentUserItems.length === 1
                  ? '1 item shared with the campus community.'
                  : `${currentUserItems.length} items shared with the campus community.`
                : 'Your lost and found reports will appear here.'
            }
            title="My reports"
            trailing={accountUser ? (
              <TextButton icon={Plus} onPress={() => router.push('/report-found')}>
                New report
              </TextButton>
            ) : null}
          />

          {currentUserItems.length ? (
            <ReportFilterTabs onChange={selectReportFilter} value={reportFilter} />
          ) : null}

          {filteredItems.length ? (
            <View style={styles.reportGrid}>
              {itemRows.map((row) => (
                <View key={row[0].id} style={styles.reportRow}>
                  {row.map((item) => (
                    <View key={item.id} style={styles.reportCell}>
                      <ItemCard
                        item={item}
                        narrow
                        now={now}
                        onOpen={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                        style={styles.reportCard}
                      />
                    </View>
                  ))}
                  {Array.from({ length: columns - row.length }, (_, index) => (
                    <View aria-hidden key={`empty-${index}`} style={styles.reportCell} />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              actionLabel={currentUserItems.length ? 'Show all' : undefined}
              message={
                currentUserItems.length
                  ? `You have no ${reportFilter} reports.`
                  : accountUser
                    ? 'Reports you publish will appear here.'
                    : 'Sign in from Settings to see your reports.'
              }
              onAction={currentUserItems.length ? () => setReportFilter('all') : undefined}
              title={currentUserItems.length ? `No ${reportFilter} reports` : 'Empty'}
            />
          )}
        </View>

        {accountUser ? (
          <View style={styles.moreSection}>
            <AppText color={colors.muted} variant="micro">MORE</AppText>
            <Surface padding={0} tone="strong">
              <AccountLink
                description={
                  role === 'admin'
                    ? 'Review reports, claims and lost-and-found intake.'
                    : 'See matches, claims and desk updates.'
                }
                icon={role === 'admin' ? LayoutDashboard : BellRing}
                label={role === 'admin' ? 'Admin dashboard' : 'Activity'}
                onPress={() => router.push(role === 'admin' ? '/admin' : '/activity')}
              />
            </Surface>
          </View>
        ) : null}
      </ContentShell>
    </Screen>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  const { colors } = useAppTheme();

  return (
    <View accessibilityLabel={`${value} ${label.toLowerCase()}`} accessible style={styles.profileStat}>
      <AppText align="center" color={colors.ink} variant="h3">{value}</AppText>
      <AppText align="center" color={colors.muted} variant="support">{label}</AppText>
    </View>
  );
}

function ReportFilterTabs({
  onChange,
  value,
}: {
  onChange: (value: ReportFilter) => void;
  value: ReportFilter;
}) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState<ReportFilter | null>(null);

  return (
    <View
      accessibilityLabel="Filter my reports"
      accessibilityRole="radiogroup"
      style={[styles.reportTabs, { borderBottomColor: colors.lineSoft }]}
    >
      {reportFilters.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onBlur={() => setFocused(null)}
            onFocus={() => setFocused(option.value)}
            onPress={() => onChange(option.value)}
            style={({ hovered, pressed }) => [
              styles.reportTab,
              { backgroundColor: hovered || pressed ? colors.wineSoft : 'transparent' },
              focusRing(focused === option.value, colors.wine),
              Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
            ]}
          >
            <AppText
              align="center"
              color={selected ? colors.wine : colors.muted}
              variant={selected ? 'bodyStrong' : 'body'}
            >
              {option.label}
            </AppText>
            {selected ? (
              <View aria-hidden style={[styles.reportTabIndicator, { backgroundColor: colors.wine }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function AccountLink({
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
        styles.accountLink,
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
        <AppText color={colors.ink} variant="bodyStrong">{label}</AppText>
        <AppText color={colors.muted} variant="support">{description}</AppText>
      </View>
      <ChevronRight aria-hidden color={colors.muted} size={20} />
    </Pressable>
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
  profile: { gap: spacing.md, paddingBottom: spacing.xl, borderBottomWidth: 1 },
  profileOverview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileOverviewStacked: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.md },
  avatar: {
    position: 'relative',
    width: 80,
    height: 80,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  avatarImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  profileStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', gap: spacing.xs },
  profileStat: { minWidth: 48, alignItems: 'center', gap: spacing.xxs },
  profileCopy: { minWidth: 0, gap: spacing.xxs },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xxs,
  },
  verifiedText: { flex: 1 },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reportsSection: { gap: spacing.lg },
  reportTabs: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
  },
  reportTab: {
    position: 'relative',
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  reportTabIndicator: {
    position: 'absolute',
    right: spacing.md,
    bottom: -1,
    left: spacing.md,
    height: 3,
    borderRadius: radius.pill,
  },
  reportGrid: { gap: spacing.sm },
  reportRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  reportCell: { flex: 1, minWidth: 0 },
  reportCard: { width: '100%', height: '100%', alignSelf: 'stretch' },
  moreSection: { gap: spacing.sm },
  accountLink: {
    minHeight: 80,
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
  flexCopy: { flex: 1, minWidth: 0 },
});
