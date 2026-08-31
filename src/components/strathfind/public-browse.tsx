import { router } from 'expo-router';
import { Building2, Filter, LayoutGrid, PackageOpen, Plus, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { focusRing, layout, radius, raisedShadow, spacing } from '@/constants/design';
import { filterItems, isRecentlyReturned } from '@/lib/item-utils';
import { categories } from '@/lib/catalog';
import type { ItemCategory } from '@/lib/types';
import { useAppState } from '@/state';
import { useAppTheme } from '@/theme/app-theme';

import { BrandLockup } from './brand';
import { IconButton, PrimaryButton, TextButton } from './buttons';
import { EmptyState } from './content';
import { TextField } from './fields';
import { ItemCard } from './item-card';
import { ContentShell, Screen } from './layout';
import { RouteLoadingScreen } from './route-loading';
import { Chip } from './selection';
import { AppText } from './typography';
import { getCategoryLabel } from './category-art';

type CategoryFilter = 'all' | ItemCategory;
type BrowseMode = 'active' | 'reunited';
type ReportView = 'all' | 'desk';

export function PublicBrowseScreen({ mode = 'active' }: { mode?: BrowseMode }) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { isAuthenticated, items, loading } = useAppState();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [reportView, setReportView] = useState<ReportView>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const narrowCards = width < 640;
  const reunited = mode === 'reunited';
  const title = reunited ? 'Reunited' : 'Lost & Found';
  const filtered = useMemo(
    () => filterItems(items, query, 'all', category).filter((item) => {
      if (reunited) return isRecentlyReturned(item);
      if (item.status === 'returned') return false;
      return reportView === 'all' || item.status === 'at_office';
    }),
    [category, items, query, reportView, reunited],
  );
  const rows = useMemo(
    () => Array.from(
      { length: Math.ceil(filtered.length / 2) },
      (_, rowIndex) => filtered.slice(rowIndex * 2, rowIndex * 2 + 2),
    ),
    [filtered],
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const openItem = (id: string) => {
    const destination = `/item/${encodeURIComponent(id)}`;
    if (!isAuthenticated) {
      router.push({ pathname: '/auth', params: { returnTo: destination } });
      return;
    }
    router.push({ pathname: '/item/[id]', params: { id } });
  };

  const report = () => {
    router.push('/report-found');
  };

  const hasSearchFilters = Boolean(query.trim()) || category !== 'all';
  const emptyTitle = hasSearchFilters
    ? 'No matches'
    : reunited
      ? 'No reunions to show yet'
      : reportView === 'desk'
        ? 'Nothing is at the desk right now'
        : 'No active reports yet';
  const emptyActionLabel = hasSearchFilters
    ? 'Clear search'
    : reunited
      ? 'Browse reports'
      : reportView === 'desk'
        ? 'View all reports'
        : 'Report an item';

  const handleEmptyAction = () => {
    if (hasSearchFilters) {
      setQuery('');
      setCategory('all');
      return;
    }
    if (reunited) {
      router.push('/lost');
      return;
    }
    if (reportView === 'desk') {
      setReportView('all');
      return;
    }
    report();
  };

  if (loading) {
    return <RouteLoadingScreen label={`Loading ${reunited ? 'reunions' : 'reports'}`} />;
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ContentShell style={styles.shell}>
        <View style={styles.topbar}>
          <BrandLockup markSize={40} />
          <TextButton
            accessibilityHint="Opens the lost and found report form"
            accessibilityLabel="Report an item"
            icon={Plus}
            onPress={report}
            style={styles.topbarAction}
          >
            Report
          </TextButton>
        </View>

        <View style={styles.heading}>
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xxs }}>
            <AppText accessibilityRole="header" variant="h1">{title}</AppText>
            <AppText color={colors.muted} variant="support">
              {reunited
                ? 'Belongings returned to their owners. Each reunion stays visible for 72 hours.'
                : 'Browse active lost and found reports from around campus.'}
            </AppText>
          </View>
          <AppText color={colors.muted} variant="support">
            {filtered.length} {filtered.length === 1 ? (reunited ? 'item' : 'report') : (reunited ? 'items' : 'reports')}
          </AppText>
        </View>

        {!reunited ? (
          <ReportViewTabs
            onChange={setReportView}
            value={reportView}
          />
        ) : null}

        <View style={styles.searchRow}>
          <TextField
            accessibilityHint="Search titles, colours, and campus locations"
            containerStyle={styles.search}
            label="Search"
            leading={<Search aria-hidden color={colors.muted} size={20} />}
            onChangeText={setQuery}
            placeholder="Item or place"
            returnKeyType="search"
            value={query}
          />
          <IconButton
            accessibilityLabel={category === 'all' ? 'Filter by category' : `Filter: ${getCategoryLabel(category)}`}
            icon={Filter}
            onPress={() => setFiltersOpen(true)}
            selected={category !== 'all'}
            style={styles.filterButton}
          />
        </View>

        {filtered.length ? (
          <View style={styles.grid}>
            {rows.map((row) => (
              <View key={row[0].id} style={styles.gridRow}>
                {row.map((item) => (
                  <View key={item.id} style={styles.gridCell}>
                    <ItemCard
                      compact={width < 900}
                      item={item}
                      narrow={narrowCards}
                      now={now}
                      onOpen={() => openItem(item.id)}
                      style={styles.gridCard}
                    />
                  </View>
                ))}
                {row.length === 1 ? <View aria-hidden style={styles.gridCell} /> : null}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            actionLabel={emptyActionLabel}
            icon={PackageOpen}
            onAction={handleEmptyAction}
            title={emptyTitle}
          />
        )}
      </ContentShell>

      <Modal animationType="fade" onRequestClose={() => setFiltersOpen(false)} transparent visible={filtersOpen}>
        <View style={[styles.modalRoot, { backgroundColor: colors.scrim }]}>
          <Pressable
            accessible={false}
            aria-hidden
            focusable={false}
            onPress={() => setFiltersOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.filterSheet,
              { backgroundColor: colors.surfaceStrong, ...raisedShadow('lg', colors.black) },
            ]}
          >
            <View style={styles.filterHeading}>
              <AppText accessibilityRole="header" variant="h3">Category</AppText>
              <IconButton accessibilityLabel="Close filters" icon={X} onPress={() => setFiltersOpen(false)} />
            </View>
            <View style={styles.chips}>
              <Chip label="All" onPress={() => setCategory('all')} selected={category === 'all'} />
              {categories.map((value) => (
                <Chip
                  key={value}
                  label={getCategoryLabel(value)}
                  onPress={() => setCategory(value)}
                  selected={category === value}
                />
              ))}
            </View>
            <PrimaryButton fullWidth onPress={() => setFiltersOpen(false)}>Show results</PrimaryButton>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ReportViewTabs({
  onChange,
  value,
}: {
  onChange: (value: ReportView) => void;
  value: ReportView;
}) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState<ReportView | null>(null);
  const options = [
    { icon: LayoutGrid, label: 'All reports', value: 'all' },
    { icon: Building2, label: 'At the desk', value: 'desk' },
  ] as const;

  return (
    <View accessibilityLabel="Browse reports" accessibilityRole="radiogroup" style={styles.browseControl}>
      <AppText color={colors.muted} variant="support">Browse reports</AppText>
      <View style={[styles.browseTabs, { borderBottomColor: colors.lineSoft }]}>
        {options.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;
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
                styles.browseTab,
                {
                  backgroundColor: hovered || pressed ? colors.wineSoft : 'transparent',
                },
                focusRing(focused === option.value, colors.wine),
                Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
              ]}
            >
              <Icon
                aria-hidden
                color={selected ? colors.wine : colors.muted}
                size={18}
                strokeWidth={selected ? 2.5 : 2}
              />
              <AppText color={selected ? colors.wine : colors.inkSoft} variant="support">
                {option.label}
              </AppText>
              {selected ? (
                <View aria-hidden style={[styles.browseIndicator, { backgroundColor: colors.wine }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
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
  topbarAction: { alignSelf: 'center', paddingHorizontal: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  browseControl: { width: '100%', maxWidth: 380, gap: spacing.xxs },
  browseTabs: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
  },
  browseTab: {
    position: 'relative',
    minHeight: layout.touchTarget,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  browseIndicator: {
    position: 'absolute',
    right: spacing.sm,
    bottom: -1,
    left: spacing.sm,
    height: 3,
    borderRadius: radius.pill,
  },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  search: { flex: 1, minWidth: 0 },
  filterButton: {
    width: layout.controlHeight,
    height: layout.controlHeight,
    marginBottom: 0,
  },
  grid: { gap: spacing.sm },
  gridRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  gridCell: { flex: 1, minWidth: 0 },
  gridCard: { width: '100%', height: '100%', alignSelf: 'stretch' },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  filterSheet: {
    width: '100%',
    maxWidth: 560,
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  filterHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
