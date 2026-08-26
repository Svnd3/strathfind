import { router } from 'expo-router';
import { ArrowLeft, BellRing, Box, CheckCircle2, Clock3, Eye, Search, ShieldCheck } from 'lucide-react-native';
import { useMemo, useState, type ComponentType } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';

import {
  AppText,
  Chip,
  ContentShell,
  EmptyState,
  ItemCard,
  Screen,
  SectionHeading,
  Surface,
  TextButton,
} from '@/components/strathfind';
import { radius, spacing } from '@/constants/design';
import type { ActivityKind } from '@/state';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

type ActivityFilter = 'all' | 'report' | 'claim' | 'match';

const activityIcons: Record<ActivityKind, ComponentType<LucideProps>> = {
  report: Box,
  claim: ShieldCheck,
  contact: Eye,
  handoff: Clock3,
  status: CheckCircle2,
  match: Search,
};

export default function ActivityScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { currentUserActivity, currentUserItems, markNotificationRead } = useAppState();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const columns = width >= 820 ? 2 : 1;
  const unread = currentUserActivity.filter((entry) => !entry.read).length;
  const filteredActivity = useMemo(
    () => currentUserActivity.filter((entry) => filter === 'all' || entry.kind === filter),
    [currentUserActivity, filter],
  );

  const openEntry = (entryId: string, itemId?: string) => {
    markNotificationRead(entryId);
    if (itemId) router.push({ pathname: '/item/[id]', params: { id: itemId } });
  };

  return (
    <Screen>
      <ContentShell style={styles.shell}>
        <View style={styles.top}>
          <View style={styles.heading}>
            <TextButton icon={ArrowLeft} onPress={() => router.back()}>Back</TextButton>
            <AppText accessibilityRole="header" variant="h1">Activity</AppText>
          </View>
          {unread ? (
            <View style={[styles.unreadPill, { backgroundColor: colors.wineSoft }]}>
              <BellRing color={colors.wine} size={18} />
              <AppText color={colors.wine} variant="support">{unread} new</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.filters}>
          {([
            ['all', 'All'],
            ['report', 'Reports'],
            ['claim', 'Claims'],
            ['match', 'Matches'],
          ] as const).map(([value, label]) => (
            <Chip key={value} label={label} onPress={() => setFilter(value)} selected={filter === value} />
          ))}
        </View>

        <Surface padding="lg" tone="strong" style={styles.timeline}>
          <SectionHeading level={3} title="Updates" />
          {filteredActivity.length ? (
            <View>
              {filteredActivity.map((entry, index) => {
                const Icon = activityIcons[entry.kind];
                return (
                  <View key={entry.id} style={styles.activityRow}>
                    <View
                      style={[
                        styles.activityRail,
                        {
                          borderRightColor:
                            index === filteredActivity.length - 1
                              ? 'transparent'
                              : colors.lineSoft,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.activityIcon,
                          { backgroundColor: colors.inset, borderColor: colors.lineSoft },
                          !entry.read && {
                            backgroundColor: colors.wineSoft,
                            borderColor: colors.wine,
                          },
                        ]}
                      >
                        <Icon color={entry.read ? colors.muted : colors.wine} size={19} />
                      </View>
                    </View>
                    <View style={styles.activityCopy}>
                      <View style={styles.activityTitleRow}>
                        <AppText variant="bodyStrong">{entry.title}</AppText>
                        {!entry.read ? (
                          <View
                            accessibilityLabel="Unread"
                            style={[styles.dot, { backgroundColor: colors.wine }]}
                          />
                        ) : null}
                      </View>
                      <AppText color={colors.muted} variant="support">{entry.message}</AppText>
                      <AppText color={colors.muted} variant="micro">{formatRelative(entry.createdAt)}</AppText>
                      {entry.itemId ? (
                        <TextButton onPress={() => openEntry(entry.id, entry.itemId)}>Open report</TextButton>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState title="Nothing in this view" />
          )}
        </Surface>

        <SectionHeading
          actionLabel="New report"
          onAction={() => router.push('/report-found')}
          title="My reports"
        />
        {currentUserItems.length ? (
          <View style={styles.grid}>
            {currentUserItems.map((item) => (
              <ItemCard
                compact={columns > 1}
                item={item}
                key={item.id}
                onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                style={{ width: columns === 1 ? '100%' : '48.8%' }}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            actionLabel="Create report"
            onAction={() => router.push('/report-found')}
            title="No reports yet"
          />
        )}
      </ContentShell>
    </Screen>
  );
}

function formatRelative(iso: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  shell: { gap: spacing.xl, paddingTop: spacing.xl },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  heading: { flex: 1, gap: spacing.xs },
  unreadPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, minHeight: 40, borderRadius: radius.pill },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  timeline: { gap: spacing.lg },
  activityRow: { flexDirection: 'row', gap: spacing.md },
  activityRail: { alignItems: 'center', width: 44, borderRightWidth: 1, marginRight: 2 },
  activityIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -40, borderRadius: radius.pill, borderWidth: 1 },
  activityCopy: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.lg },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
