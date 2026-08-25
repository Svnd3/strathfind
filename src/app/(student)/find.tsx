import { router } from 'expo-router';
import { Bell, BellRing, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  AppText,
  BrandLockup,
  Chip,
  ContentShell,
  EmptyState,
  IconButton,
  ItemCard,
  Screen,
  SectionHeading,
  SegmentedControl,
  Surface,
  TextField,
  getCategoryLabel,
} from '@/components/strathfind';
import { palette, spacing } from '@/constants/design';
import { haptics } from '@/lib/haptics';
import { filterItems } from '@/lib/item-utils';
import { categories } from '@/lib/catalog';
import { readPreference, writePreference } from '@/lib/preferences';
import type { ItemCategory, ItemKind } from '@/lib/types';
import { useAppState } from '@/state';

type KindFilter = 'all' | ItemKind;
type CategoryFilter = 'all' | ItemCategory;
type SavedSearch = { query: string; kind: KindFilter; category: CategoryFilter; key: string };
const SAVED_SEARCHES_KEY = 'strathfind.saved-searches.v1';

function parseSavedSearch(key: string): SavedSearch | null {
  try {
    const value = JSON.parse(key) as Partial<SavedSearch>;
    const kind = value.kind;
    const category = value.category;
    if (typeof value.query !== 'string' || !kind || !category) return null;
    if (!['all', 'found', 'lost'].includes(kind)) return null;
    if (category !== 'all' && !categories.includes(category as ItemCategory)) return null;
    return { query: value.query, kind, category, key };
  } catch {
    return null;
  }
}

function savedSearchLabel(search: SavedSearch) {
  const parts = [
    search.query ? `“${search.query}”` : null,
    search.kind === 'all' ? null : search.kind === 'found' ? 'Found' : 'Lost',
    search.category === 'all' ? null : getCategoryLabel(search.category),
  ].filter(Boolean);
  return parts.join(' · ') || 'All reports';
}

export default function FindScreen() {
  const { width } = useWindowDimensions();
  const { items, notifications } = useAppState();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [savedSearches, setSavedSearches] = useState<string[]>([]);
  const columns = width >= 1080 ? 3 : width >= 680 ? 2 : 1;
  const unread = notifications.filter((entry) => !entry.read).length;
  const searchKey = JSON.stringify({ query: query.trim().toLowerCase(), kind, category });
  const saved = savedSearches.includes(searchKey);
  const savedSearchOptions = useMemo(
    () => savedSearches.map(parseSavedSearch).filter((value): value is SavedSearch => Boolean(value)),
    [savedSearches],
  );

  useEffect(() => {
    void readPreference<string[]>(SAVED_SEARCHES_KEY, []).then(setSavedSearches);
  }, []);

  const filtered = useMemo(
    () => filterItems(items, query, kind, category),
    [category, items, kind, query],
  );

  const updateKind = (value: KindFilter) => {
    setKind(value);
    void haptics.select();
  };

  const toggleSavedSearch = () => {
    const next = saved
      ? savedSearches.filter((value) => value !== searchKey)
      : [...savedSearches, searchKey];
    setSavedSearches(next);
    void writePreference(SAVED_SEARCHES_KEY, next);
    void haptics.confirm();
  };

  const applySavedSearch = (search: SavedSearch) => {
    setQuery(search.query);
    setKind(search.kind);
    setCategory(search.category);
    void haptics.select();
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ContentShell style={styles.shell}>
        <View style={styles.header}>
          <BrandLockup compact={width < 370} markSize={40} />
          <View>
            <IconButton
              accessibilityLabel="Open activity"
              icon={unread ? BellRing : Bell}
              onPress={() => router.push('/(student)/activity')}
            />
            {unread ? <View accessibilityLabel={`${unread} unread`} style={styles.unreadDot} /> : null}
          </View>
        </View>

        <AppText accessibilityRole="header" variant="h1">Find an item</AppText>

        <Surface padding="md" tone="strong" style={styles.searchPanel}>
          <View style={[styles.searchTop, width >= 760 && styles.searchTopWide]}>
            <TextField
              accessibilityHint="Search item names, colours, buildings, or categories"
              containerStyle={styles.searchField}
              label="Search"
              leading={<Search color={palette.muted} size={20} />}
              onChangeText={setQuery}
              placeholder="Item or location"
              returnKeyType="search"
              value={query}
            />
            <SegmentedControl
              label="Type"
              onChange={updateKind}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Found', value: 'found' },
                { label: 'Lost', value: 'lost' },
              ]}
              style={[styles.typeControl, width >= 760 && styles.typeControlWide]}
              value={kind}
            />
          </View>
          <AppText variant="support">Category</AppText>
          <ScrollView
            horizontal
            contentContainerStyle={styles.chips}
            showsHorizontalScrollIndicator={false}
          >
            <Chip label="All" onPress={() => setCategory('all')} selected={category === 'all'} />
            {categories.map((value) => (
              <Chip
                key={value}
                label={getCategoryLabel(value)}
                onPress={() => { setCategory(value); void haptics.select(); }}
                selected={category === value}
              />
            ))}
          </ScrollView>
          {savedSearchOptions.length ? (
            <View style={styles.savedBlock}>
              <AppText color={palette.muted} variant="micro">SAVED SEARCHES</AppText>
              <ScrollView
                horizontal
                contentContainerStyle={styles.chips}
                showsHorizontalScrollIndicator={false}
              >
                {savedSearchOptions.map((search) => (
                  <Chip
                    key={search.key}
                    label={savedSearchLabel(search)}
                    onPress={() => applySavedSearch(search)}
                    selected={search.key === searchKey}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </Surface>

        <SectionHeading
          actionLabel={saved ? 'Remove saved' : 'Save search'}
          onAction={toggleSavedSearch}
          title={`${filtered.length} ${filtered.length === 1 ? 'report' : 'reports'}`}
        />

        {filtered.length ? (
          <View style={styles.grid}>
            {filtered.map((item) => (
              <ItemCard
                compact={columns > 1}
                item={item}
                key={item.id}
                onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
                style={{ width: columns === 1 ? '100%' : columns === 2 ? '48.8%' : '32%' }}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            actionLabel="Clear filters"
            onAction={() => { setQuery(''); setKind('all'); setCategory('all'); }}
            title="No reports found"
          />
        )}
      </ContentShell>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: { gap: spacing.xl, paddingTop: spacing.md },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  unreadDot: { position: 'absolute', top: 3, right: 3, width: 10, height: 10, borderRadius: 5, backgroundColor: palette.yellow, borderColor: palette.wine, borderWidth: 2 },
  searchPanel: { gap: spacing.md },
  searchTop: { gap: spacing.md },
  searchTopWide: { flexDirection: 'row', alignItems: 'flex-start' },
  searchField: { flex: 1, minWidth: 0 },
  typeControl: { width: '100%' },
  typeControlWide: { width: 330 },
  chips: { gap: spacing.xs, paddingRight: spacing.md },
  savedBlock: { gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: palette.lineSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'stretch' },
});
