import { useState, type ComponentType } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
  CircleHelp,
  Clock3,
  CreditCard,
  CupSoda,
  KeyRound,
  MapPin,
  Maximize2,
  Shirt,
  Smartphone,
  X,
  type LucideProps,
} from 'lucide-react-native';

import { radius, raisedShadow, spacing } from '@/constants/design';
import { handoffLabel, isHandoffUrgent } from '@/lib/item-utils';
import type { ItemCategory, LostFoundItem } from '@/lib/types';
import { useAppTheme } from '@/theme/app-theme';

import { IconButton, PrimaryButton } from './buttons';
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
  /** Optimise the card for a narrow two-column phone grid. */
  narrow?: boolean;
  now?: Date;
  style?: StyleProp<ViewStyle>;
  /** Control the quick-view dialog from a parent when needed. */
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
  return focused && Platform.OS !== 'web' ? { borderColor: color, borderWidth: 2 } : {};
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
  narrow,
}: {
  hidden: boolean;
  item: PublicItemCardItem;
  narrow: boolean;
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
      <View
        aria-hidden
        style={[
          styles.fallbackHalo,
          narrow && styles.fallbackHaloNarrow,
          { borderColor: tone.foreground },
        ]}
      />
      <Icon aria-hidden color={tone.foreground} size={narrow ? 56 : 104} strokeWidth={1.55} />
    </View>
  );
}

export function ItemCard({
  item,
  compact = false,
  narrow = false,
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

  const setExpanded = (nextExpanded: boolean) => {
    if (controlledExpanded === undefined) setInternalExpanded(nextExpanded);
    onExpandedChange?.(nextExpanded);
  };

  const openDetails = () => setExpanded(true);
  const closeDetails = () => setExpanded(false);

  const openItem = (event: GestureResponderEvent) => {
    event.stopPropagation();
    closeDetails();
    if (onOpen) onOpen();
    else legacyOnPress?.(event);
  };

  const renderMedia = (inModal = false) => {
    const useNarrowMedia = narrow && !inModal;

    return (
      <View
        style={[
          styles.media,
          inModal
            ? styles.modalMedia
            : useNarrowMedia
              ? styles.mediaNarrow
              : compact
                ? styles.mediaCompact
                : styles.mediaLarge,
          { backgroundColor: colors.inset },
        ]}
      >
          <ItemFallbackArt hidden={imageLoaded} item={item} narrow={useNarrowMedia} />
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
          <View
            pointerEvents="none"
            style={[styles.statuses, useNarrowMedia && styles.statusesNarrow]}
          >
            <StatusPill
              kind={item.kind}
              style={useNarrowMedia ? styles.statusPillNarrow : undefined}
            />
            {item.status !== 'published' ? (
              <StatusPill
                status={item.status}
                style={useNarrowMedia ? styles.statusPillNarrow : undefined}
              />
            ) : null}
          </View>
          {useNarrowMedia ? (
            <View
              aria-hidden
              pointerEvents="none"
              style={[
                styles.narrowDisclosure,
                { backgroundColor: colors.surfaceStrong, borderColor: colors.lineSoft },
              ]}
            >
              <Maximize2 color={colors.wine} size={16} strokeWidth={2.4} />
            </View>
          ) : null}
      </View>
    );
  };

  return (
    <>
      <View
        style={[
          styles.card,
          narrow ? styles.cardNarrow : compact ? styles.cardCompact : styles.cardLarge,
          {
            borderColor: colors.lineSoft,
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
          accessibilityHint={accessibilityHint ?? 'Shows item details in a dialog'}
          accessibilityLabel={
            accessibilityLabel ?? `Open details for ${item.kind} item: ${item.title}`
          }
          accessibilityRole="button"
          accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled), expanded }}
          aria-haspopup="dialog"
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
          onPress={openDetails}
          style={({ pressed }) => [
            styles.expandButton,
            narrow && styles.expandButtonNarrow,
            {
              backgroundColor: pressed ? colors.inset : 'transparent',
              transform: [{ scale: pressed ? 0.992 : 1 }],
              ...(Platform.OS === 'web'
                ? ({ cursor: disabled ? 'default' : 'pointer' } as ViewStyle)
                : {}),
            },
          ]}
        >
          {renderMedia()}

          <View style={[styles.content, narrow && styles.contentNarrow]}>
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <AppText color={colors.muted} numberOfLines={1} variant="micro">
                  {getCategoryLabel(item.category).toUpperCase()}
                </AppText>
                <AppText
                  color={colors.ink}
                  numberOfLines={2}
                  variant={narrow ? 'bodyStrong' : 'h3'}
                >
                  {item.title}
                </AppText>
              </View>
              {!narrow ? (
                <View aria-hidden style={styles.disclosureCue}>
                  <AppText color={colors.wine} variant="micro">
                    DETAILS
                  </AppText>
                  <Maximize2 color={colors.wine} size={18} strokeWidth={2.4} />
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        aria-label={`Item details: ${item.title}`}
        onRequestClose={closeDetails}
        transparent
        visible={expanded}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.scrim }]}>
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={closeDetails}
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surfaceStrong,
                borderColor: colors.lineSoft,
                ...raisedShadow('lg', colors.black),
              },
            ]}
          >
            <ScrollView
              accessibilityLabel={`Scrollable details for ${item.title}`}
              contentContainerStyle={styles.modalScrollContent}
              onAccessibilityEscape={closeDetails}
              showsVerticalScrollIndicator={false}
              style={styles.modalScroll}
            >
              <View style={styles.modalHeading}>
                <View style={styles.modalHeadingCopy}>
                  <AppText color={colors.muted} variant="micro">
                    {getCategoryLabel(item.category).toUpperCase()}
                  </AppText>
                  <AppText accessibilityRole="header" color={colors.ink} variant="h2">
                    {item.title}
                  </AppText>
                </View>
                <IconButton
                  accessibilityLabel={`Close details for ${item.title}`}
                  icon={X}
                  onAccessibilityEscape={closeDetails}
                  onPress={closeDetails}
                />
              </View>

              <View style={styles.modalBody}>
                {renderMedia(true)}

                <View style={styles.modalDetails}>
                  {item.description.trim() ? (
                    <AppText color={colors.inkSoft} variant="body">
                      {item.description.trim()}
                    </AppText>
                  ) : null}

                  <View style={styles.detailList}>
                    <View style={styles.detailRow}>
                      <MapPin aria-hidden color={colors.wine} size={20} strokeWidth={2.2} />
                      <AppText color={colors.inkSoft} style={styles.detailText} variant="body">
                        {item.location}
                      </AppText>
                    </View>
                    <View style={styles.detailRow}>
                      <Clock3
                        aria-hidden
                        color={urgent ? colors.danger : colors.wine}
                        size={20}
                        strokeWidth={2.2}
                      />
                      <AppText
                        color={urgent ? colors.danger : colors.inkSoft}
                        style={styles.detailText}
                        variant="body"
                      >
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
              </View>
            </ScrollView>

            {hasOpenAction ? (
              <View style={[styles.modalFooter, { borderTopColor: colors.lineSoft }]}>
                <PrimaryButton
                  accessibilityLabel={`View full details for ${item.title}`}
                  disabled={disabled}
                  fullWidth
                  icon={ArrowUpRight}
                  iconPosition="right"
                  onAccessibilityEscape={closeDetails}
                  onPress={openItem}
                >
                  View item
                </PrimaryButton>
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityElementsHidden
            accessible={false}
            aria-hidden
            focusable={false}
            importantForAccessibility="no-hide-descendants"
            onPress={closeDetails}
            style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
            tabIndex={-1}
          />
        </View>
      </Modal>
    </>
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
  cardNarrow: {
    minHeight: 0,
  },
  cardLarge: {
    minHeight: 344,
  },
  expandButton: {
    width: '100%',
    borderRadius: radius.lg,
  },
  expandButtonNarrow: {
    flex: 1,
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
  mediaNarrow: {
    aspectRatio: 1,
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
  fallbackHaloNarrow: {
    width: 104,
    height: 104,
    right: -28,
    bottom: -44,
    borderWidth: 16,
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
  statusesNarrow: {
    top: spacing.xs,
    left: spacing.xs,
    right: spacing.xs,
    flexDirection: 'column',
    gap: spacing.xxs,
  },
  statusPillNarrow: {
    maxWidth: '100%',
    paddingHorizontal: spacing.xs,
  },
  narrowDisclosure: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  content: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  contentNarrow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xxs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxs,
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
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalBackdrop: {
    zIndex: 0,
  },
  modalCard: {
    zIndex: 1,
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalHeadingCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  modalScroll: {
    flexShrink: 1,
    minHeight: 0,
  },
  modalScrollContent: {
    paddingBottom: spacing.md,
  },
  modalBody: {
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  modalMedia: {
    height: 240,
  },
  modalDetails: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
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
  modalFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
  },
});
