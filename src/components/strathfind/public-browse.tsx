import { router } from 'expo-router';
import { Filter, PackageOpen, Plus, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { palette, radius, raisedShadow, spacing } from '@/constants/design';
import { filterItems } from '@/lib/item-utils';
import { categories } from '@/lib/catalog';
import type { ItemCategory, ItemKind } from '@/lib/types';
import { useAppState } from '@/state';

import { BrandLockup } from './brand';
import { IconButton, PrimaryButton, SecondaryButton } from './buttons';
import { EmptyState } from './content';
import { TextField } from './fields';
import { ItemCard } from './item-card';
import { ContentShell, Screen } from './layout';
import { Chip } from './selection';
import { AppText } from './typography';
import { getCategoryLabel } from './category-art';

type CategoryFilter = 'all' | ItemCategory;

export function PublicBrowseScreen({ kind }: { kind: ItemKind }) {
  const { width } = useWindowDimensions();
  const { isAuthenticated, items } = useAppState();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const columns = width >= 1280 ? 3 : width >= 720 ? 2 : 1;
  const title = kind === 'lost' ? 'Lost' : 'Found';
  const filtered = useMemo(
    () => filterItems(items, query, kind, category).filter((item) => item.status !== 'returned'),
    [category, items, kind, query],
  );

  const openItem = (id: string) => {
    const destination = `/item/${encodeURIComponent(id)}`;
    if (!isAuthenticated) {
      router.push({ pathname: '/auth', params: { returnTo: destination } });
      return;
    }
    router.push({ pathname: '/item/[id]', params: { id } });
  };

  const report = () => {
    router.push({ pathname: '/report-found', params: { kind } });
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ContentShell style={styles.shell}>
        <View style={styles.topbar}>
          <BrandLockup markSize={40} />
          <SecondaryButton icon={Plus} onPress={report} style={styles.topbarAction}>Report</SecondaryButton>
        </View>

        <View style={styles.heading}>
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xxs }}>
            <AppText accessibilityRole="header" variant="h1">{title}</AppText>
            <AppText color={palette.muted} variant="support">
              {kind === 'lost' ? 'Items people are looking for.' : 'Items waiting to get home.'}
            </AppText>
          </View>
          <AppText color={palette.muted} variant="support">
            {filtered.length} {filtered.length === 1 ? 'report' : 'reports'}
          </AppText>
        </View>

        <View style={styles.searchRow}>
          <TextField
            accessibilityHint="Search titles, colours, and campus locations"
            containerStyle={styles.search}
            label="Search"
            leading={<Search aria-hidden color={palette.muted} size={20} />}
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
            {filtered.map((item) => (
              <ItemCard
                compact={columns > 1}
                item={item}
                key={item.id}
                onOpen={() => openItem(item.id)}
                style={{ width: columns === 1 ? '100%' : columns === 2 ? '48.8%' : '32%' }}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            actionLabel={query || category !== 'all' ? 'Clear search' : `Report ${kind} item`}
            icon={PackageOpen}
            onAction={() => {
              if (query || category !== 'all') {
                setQuery('');
                setCategory('all');
              } else {
                report();
              }
            }}
            title={query || category !== 'all' ? 'No matches' : `No ${kind} reports yet`}
          />
        )}
      </ContentShell>

      <Modal animationType="fade" onRequestClose={() => setFiltersOpen(false)} transparent visible={filtersOpen}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close filters"
            accessibilityRole="button"
            onPress={() => setFiltersOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.filterSheet}>
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

const styles = StyleSheet.create({
  shell: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  topbar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  topbarAction: { alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  search: { flex: 1, minWidth: 0 },
  filterButton: { marginBottom: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing.md,
    backgroundColor: 'rgba(36,27,30,0.58)',
  },
  filterSheet: {
    width: '100%',
    maxWidth: 560,
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceStrong,
    ...raisedShadow('lg'),
  },
  filterHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
