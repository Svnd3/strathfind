import { useState, type ComponentType } from 'react';
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
import {
  ArrowUpRight,
  Backpack,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Clock3,
  CreditCard,
  CupSoda,
  KeyRound,
  MapPin,
  Shirt,
  Smartphone,
  type LucideProps,
} from 'lucide-react-native';

import { radius, raisedShadow, spacing } from '@/constants/design';
import { handoffLabel, isHandoffUrgent } from '@/lib/item-utils';
import type { ItemCategory, LostFoundItem } from '@/lib/types';
import { useAppTheme } from '@/theme/app-theme';

import { getCategoryLabel } from './category-art';
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

function cardFocusRing(focused: boolean, color: string): ViewStyle {
  return focused ? { borderColor: color, borderWidth: 2 } : {};
}

const fallbackIcons: Record<ItemCategory, ComponentType<LucideProps>> = {
  electronics: Smartphone,
  identity: CreditCard,
  keys: KeyRound,
  bags: Backpack,
  clothing: Shirt,
  books: BookOpen,
  bottles: CupSoda,
  other: CircleHelp,
};

// Drawn from the vivid red and green reference cards. Near-black content keeps
// normal-size text above WCAG AA contrast on both backgrounds.
const fallbackTones = [
  { background: '#FA1747', foreground: '#171013' },
  { background: '#00A884', foreground: '#171013' },
] as const;

function fallbackToneFor(item: PublicItemCardItem) {
  const seed = `${item.category}:${item.id}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return fallbackTones[Math.abs(hash) % fallbackTones.length];
}

function ItemFallbackArt({
  hidden,
  item,
}: {
  hidden: boolean;
  item: PublicItemCardItem;
}) {
  const Icon = fallbackIcons[item.category];
  const categoryLabel = getCategoryLabel(item.category);
  const tone = fallbackToneFor(item);

  return (
    <View
      accessibilityElementsHidden={hidden}
      accessibilityLabel={`No photo uploaded. ${categoryLabel} illustration for ${item.title}`}
      accessibilityRole="image"
      accessible={!hidden}
      aria-hidden={hidden}
      pointerEvents="none"
      style={[styles.mediaFill, styles.fallbackArt, { backgroundColor: tone.background }]}
    >
      <View aria-hidden style={[styles.fallbackHalo, { borderColor: tone.foreground }]} />
      <Icon aria-hidden color={tone.foreground} size={104} strokeWidth={1.55} />
    </View>
  );
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
  const { colors } = useAppTheme();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const [focused, setFocused] = useState(false);
  const [actionFocused, setActionFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [loadedImageUri, setLoadedImageUri] = useState<string | null>(null);
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  const expanded = controlledExpanded ?? internalExpanded;
  const hasOpenAction = Boolean(onOpen || legacyOnPress);
  const shouldAttemptImage = Boolean(item.imageUri && failedImageUri !== item.imageUri);
  const imageLoaded = Boolean(
    shouldAttemptImage && item.imageUri && loadedImageUri === item.imageUri,
  );

  // The shared time helpers only inspect kind/status/deadline fields.
  const itemForTime = item as LostFoundItem;
  const urgent = isHandoffUrgent(itemForTime, now);
  const itemLabel = accessibilityLabel ?? `${item.kind === 'found' ? 'Found' : 'Lost'}: ${item.title}`;
  const expandedAccessibilityLabel = [
    itemLabel,
    item.description.trim(),
    `Location: ${item.location}`,
    `Date and time: ${formatDateTime(item.foundAt)}`,
    urgent ? handoffLabel(itemForTime, now) : '',
  ].filter(Boolean).join('. ');

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
          borderColor: hovered || focused ? colors.wine : colors.lineSoft,
          backgroundColor: colors.surfaceStrong,
          opacity: disabled ? 0.55 : 1,
          ...raisedShadow(hovered ? 'md' : 'sm', colors.black),
        },
        cardFocusRing(focused, colors.wine),
        style,
      ]}
    >
      <Pressable
        {...pressableProps}
        accessibilityHint={accessibilityHint ?? (expanded ? 'Hide item summary' : 'Show location and time')}
        accessibilityLabel={expanded ? expandedAccessibilityLabel : itemLabel}
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
            backgroundColor: pressed ? colors.inset : 'transparent',
            transform: [{ scale: pressed ? 0.992 : 1 }],
            ...(Platform.OS === 'web' ? ({ cursor: disabled ? 'default' : 'pointer' } as ViewStyle) : {}),
          },
        ]}
      >
        <View
          style={[
            styles.media,
            compact ? styles.mediaCompact : styles.mediaLarge,
            { backgroundColor: colors.inset },
          ]}
        >
          <ItemFallbackArt hidden={imageLoaded} item={item} />
          {shouldAttemptImage && item.imageUri ? (
            <Image
              accessibilityElementsHidden={!imageLoaded}
              accessibilityLabel={imageLoaded ? `Photo of ${item.title}` : undefined}
              accessible={imageLoaded}
              aria-hidden={!imageLoaded}
              onError={() => setFailedImageUri(item.imageUri ?? null)}
              onLoad={() => setLoadedImageUri(item.imageUri ?? null)}
              resizeMode="cover"
              source={{ uri: item.imageUri }}
              style={[styles.mediaFill, styles.itemImage, { opacity: imageLoaded ? 1 : 0 }]}
            />
          ) : null}
          <View pointerEvents="none" style={styles.statuses}>
            <StatusPill kind={item.kind} />
            {item.status !== 'published' ? <StatusPill status={item.status} /> : null}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <AppText color={colors.muted} variant="micro">
                {getCategoryLabel(item.category).toUpperCase()}
              </AppText>
              <AppText color={colors.ink} numberOfLines={expanded ? 3 : 2} variant="h3">
                {item.title}
              </AppText>
            </View>
            <View aria-hidden style={styles.disclosureCue}>
              <AppText color={colors.wine} variant="micro">
                {expanded ? 'LESS' : 'DETAILS'}
              </AppText>
              <ChevronDown
                color={colors.wine}
                size={18}
                strokeWidth={2.4}
                style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
              />
            </View>
          </View>

          {expanded ? (
            <View style={[styles.expandedContent, { borderTopColor: colors.lineSoft }]}>
              {item.description.trim() ? (
                <AppText color={colors.inkSoft} numberOfLines={3} variant="support">
                  {item.description.trim()}
                </AppText>
              ) : null}

              <View style={styles.detailList}>
                <View style={styles.detailRow}>
                  <MapPin aria-hidden color={colors.wine} size={18} strokeWidth={2.2} />
                  <AppText color={colors.inkSoft} style={styles.detailText} variant="support">
                    {item.location}
                  </AppText>
                </View>
                <View style={styles.detailRow}>
                  <Clock3 aria-hidden color={urgent ? colors.danger : colors.wine} size={18} strokeWidth={2.2} />
                  <AppText color={urgent ? colors.danger : colors.inkSoft} style={styles.detailText} variant="support">
                    {formatDateTime(item.foundAt)}
                  </AppText>
                </View>
                {urgent ? (
                  <AppText color={colors.danger} variant="micro">
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
              { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
              cardFocusRing(actionFocused, colors.yellow),
            ]}
          >
            <AppText color={colors.onPrimary} variant="support">View item</AppText>
            <ArrowUpRight aria-hidden color={colors.onPrimary} size={18} strokeWidth={2.3} />
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
  itemImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  fallbackArt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackHalo: {
    position: 'absolute',
    width: 196,
    height: 196,
    right: -54,
    bottom: -78,
    borderRadius: radius.pill,
    borderWidth: 28,
    opacity: 0.14,
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
