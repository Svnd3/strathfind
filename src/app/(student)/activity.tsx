import { router } from 'expo-router';
import { BellRing, Box, CheckCircle2, Clock3, Eye, Search, ShieldCheck } from 'lucide-react-native';
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
import { palette, radius, spacing } from '@/constants/design';
import type { ActivityKind } from '@/state';
import { useAppState } from '@/state';

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
            <AppText color={palette.wine} variant="micro">YOUR CAMPUS TRAIL</AppText>
            <AppText accessibilityRole="header" variant="h1">Activity</AppText>
            <AppText color={palette.muted} variant="body">
              Claims, matches and handoffs in one place.
            </AppText>
          </View>
          {unread ? (
            <View style={styles.unreadPill}>
              <BellRing color={palette.wine} size={18} />
              <AppText color={palette.wine} variant="support">{unread} new</AppText>
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

        <Surface padding="lg" style={styles.timeline}>
          <SectionHeading
            description="Tap an update to open the related report."
            level={3}
            title="Latest updates"
          />
          {filteredActivity.length ? (
            <View>
              {filteredActivity.map((entry, index) => {
                const Icon = activityIcons[entry.kind];
                return (
                  <View key={entry.id} style={styles.activityRow}>
                    <View style={[styles.activityRail, index === filteredActivity.length - 1 && styles.lastRail]}>
                      <View style={[styles.activityIcon, !entry.read && styles.activityIconUnread]}>
                        <Icon color={entry.read ? palette.muted : palette.wine} size={19} />
                      </View>
                    </View>
                    <View style={styles.activityCopy}>
                      <View style={styles.activityTitleRow}>
                        <AppText variant="bodyStrong">{entry.title}</AppText>
                        {!entry.read ? <View accessibilityLabel="Unread" style={styles.dot} /> : null}
                      </View>
                      <AppText color={palette.muted} variant="support">{entry.message}</AppText>
                      <AppText color={palette.muted} variant="micro">{formatRelative(entry.createdAt)}</AppText>
                      {entry.itemId ? (
                        <TextButton onPress={() => openEntry(entry.id, entry.itemId)}>Open report</TextButton>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState message="New updates will appear here." title="Nothing in this view" />
          )}
        </Surface>

        <SectionHeading
          actionLabel="New report"
          description="Track every report through to a safe return."
          onAction={() => router.push('/(student)/report')}
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
            message="Lost and found reports you create will appear here."
            onAction={() => router.push('/(student)/report')}
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
  unreadPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, minHeight: 40, borderRadius: radius.pill, backgroundColor: palette.wineSoft },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  timeline: { gap: spacing.lg },
  activityRow: { flexDirection: 'row', gap: spacing.md },
  activityRail: { alignItems: 'center', width: 44, borderRightWidth: 1, borderRightColor: palette.lineSoft, marginRight: 2 },
  lastRail: { borderRightColor: 'transparent' },
  activityIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -40, borderRadius: radius.pill, backgroundColor: palette.inset, borderWidth: 1, borderColor: palette.lineSoft },
  activityIconUnread: { backgroundColor: palette.wineSoft, borderColor: palette.wine },
  activityCopy: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.lg },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.wine },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
