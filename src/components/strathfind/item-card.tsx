import { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ArrowUpRight, ChevronDown, Clock3, MapPin } from 'lucide-react-native';

import { focusRing, palette, radius, raisedShadow, spacing } from '@/constants/design';
import { handoffLabel, isHandoffUrgent } from '@/lib/item-utils';
import type { LostFoundItem } from '@/lib/types';

import { CategoryArt, getCategoryLabel } from './category-art';
import { StatusPill } from './status';
import { AppText } from './typography';

export type PublicItemCardItem = Omit<LostFoundItem, 'holderPhone'> & {
  maskedPhone?: string;
};

export interface ItemCardProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Public-safe item data. Full holder contact is deliberately not accepted. */
  item: PublicItemCardItem;
  compact?: boolean;
  now?: Date;
  style?: StyleProp<ViewStyle>;
  /** Control the quick-view disclosure from a parent when needed. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Preferred explicit action for opening the full item page. */
  onOpen?: () => void;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function ItemCard({
  item,
  compact = false,
  now = new Date(),
  style,
  expanded: controlledExpanded,
  defaultExpanded = false,
  onExpandedChange,
  onOpen,
  onPress: legacyOnPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  disabled,
  onBlur,
  onFocus,
  ...pressableProps
}: ItemCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const [focused, setFocused] = useState(false);
  const [actionFocused, setActionFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const expanded = controlledExpanded ?? internalExpanded;
  const hasOpenAction = Boolean(onOpen || legacyOnPress);

  // The shared time helpers only inspect kind/status/deadline fields.
  const itemForTime = item as LostFoundItem;
  const urgent = isHandoffUrgent(itemForTime, now);

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    if (controlledExpanded === undefined) setInternalExpanded(nextExpanded);
    onExpandedChange?.(nextExpanded);
  };

  const openItem = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (onOpen) onOpen();
    else legacyOnPress?.(event);
  };

  return (
    <View
      style={[
        styles.card,
        compact ? styles.cardCompact : styles.cardLarge,
        {
          borderColor: hovered || focused ? palette.wine : palette.lineSoft,
          backgroundColor: palette.surfaceStrong,
          opacity: disabled ? 0.55 : 1,
          ...raisedShadow(hovered ? 'md' : 'sm'),
        },
        focusRing(focused),
        style,
      ]}
    >
      <Pressable
        {...pressableProps}
        accessibilityHint={accessibilityHint ?? (expanded ? 'Hide item summary' : 'Show location and time')}
        accessibilityLabel={accessibilityLabel ?? `${item.kind === 'found' ? 'Found' : 'Lost'}: ${item.title}`}
        accessibilityRole="button"
        accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled), expanded }}
        disabled={disabled}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={toggleExpanded}
        style={({ pressed }) => [
          styles.expandButton,
          {
            backgroundColor: pressed ? palette.inset : 'transparent',
            transform: [{ scale: pressed ? 0.992 : 1 }],
            ...(Platform.OS === 'web' ? ({ cursor: disabled ? 'default' : 'pointer' } as ViewStyle) : {}),
          },
        ]}
      >
        <View style={[styles.media, compact ? styles.mediaCompact : styles.mediaLarge]}>
        {item.imageUri ? (
          <Image
            accessibilityLabel={`Photo of ${item.title}`}
            resizeMode="cover"
            source={{ uri: item.imageUri }}
            style={styles.mediaFill}
          />
        ) : (
          <CategoryArt
            category={item.category}
            size={compact ? 192 : 216}
            style={styles.mediaFill}
          />
        )}
        <View pointerEvents="none" style={styles.statuses}>
          <StatusPill kind={item.kind} />
          {item.status !== 'published' ? <StatusPill status={item.status} /> : null}
        </View>
        </View>

        <View style={styles.content}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <AppText color={palette.muted} variant="micro">
                {getCategoryLabel(item.category).toUpperCase()}
              </AppText>
              <AppText numberOfLines={expanded ? 3 : 2} variant="h3">
                {item.title}
              </AppText>
            </View>
            <View aria-hidden style={styles.disclosureCue}>
              <AppText color={palette.wine} variant="micro">
                {expanded ? 'LESS' : 'DETAILS'}
              </AppText>
              <ChevronDown
                color={palette.wine}
                size={18}
                strokeWidth={2.4}
                style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
              />
            </View>
          </View>

          {expanded ? (
            <View style={styles.expandedContent}>
              {item.description.trim() ? (
                <AppText color={palette.inkSoft} numberOfLines={3} variant="support">
                  {item.description.trim()}
                </AppText>
              ) : null}

              <View style={styles.detailList}>
                <View style={styles.detailRow}>
                  <MapPin aria-hidden color={palette.wine} size={18} strokeWidth={2.2} />
                  <AppText color={palette.inkSoft} style={styles.detailText} variant="support">
                    {item.location}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <Clock3 aria-hidden color={urgent ? palette.danger : palette.wine} size={18} strokeWidth={2.2} />
                  <AppText color={urgent ? palette.danger : palette.inkSoft} style={styles.detailText} variant="support">
                    {formatDateTime(item.foundAt)}
                  </AppText>
                </View>
                {urgent ? (
                  <AppText color={palette.danger} variant="micro">
                    {handoffLabel(itemForTime, now).toUpperCase()}
                  </AppText>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>

      {expanded && hasOpenAction ? (
        <View style={styles.openActionWrap}>
          <Pressable
            accessibilityLabel={`View full details for ${item.title}`}
            accessibilityRole="button"
            disabled={disabled}
            onBlur={() => setActionFocused(false)}
            onFocus={() => setActionFocused(true)}
            onPress={openItem}
            style={({ pressed }) => [
              styles.openButton,
              { backgroundColor: pressed ? palette.winePressed : palette.wine },
              focusRing(actionFocused),
            ]}
          >
            <AppText color={palette.white} variant="support">View item</AppText>
            <ArrowUpRight aria-hidden color={palette.white} size={18} strokeWidth={2.3} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    minHeight: 48,
    overflow: 'hidden',
    padding: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  cardCompact: {
    minHeight: 312,
  },
  cardLarge: {
    minHeight: 344,
  },
  expandButton: {
    width: '100%',
    borderRadius: radius.lg,
  },
  media: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    borderRadius: radius.lg,
    backgroundColor: palette.inset,
  },
  mediaCompact: {
    height: 192,
  },
  mediaLarge: {
    height: 216,
  },
  mediaFill: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
  },
  statuses: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  content: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  disclosureCue: {
    minHeight: 48,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  expandedContent: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.lineSoft,
  },
  detailList: {
    gap: spacing.sm,
  },
  detailRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  detailText: {
    flex: 1,
    minWidth: 0,
  },
  openActionWrap: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  openButton: {
    minHeight: 48,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
});
