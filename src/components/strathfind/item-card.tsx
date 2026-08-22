import { useState } from 'react';
import {
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ArrowUpRight, Clock3, MapPin } from 'lucide-react-native';

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
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

export function ItemCard({ item, compact = false, now = new Date(), style, ...props }: ItemCardProps) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { width } = useWindowDimensions();
  const horizontal = !compact && width >= 540;
  // The shared time helpers only inspect kind/status/deadline fields.
  const itemForTime = item as LostFoundItem;
  const urgent = isHandoffUrgent(itemForTime, now);

  return (
    <Pressable
      {...props}
      accessibilityLabel={`${item.kind === 'found' ? 'Found' : 'Lost'}: ${item.title}, ${item.location}`}
      accessibilityRole="button"
      accessibilityHint="Open item details"
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        {
          flexDirection: horizontal ? 'row' : 'column',
          gap: spacing.md,
          padding: spacing.md,
          overflow: 'hidden',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: hovered ? palette.wine : palette.lineSoft,
          backgroundColor: pressed ? palette.inset : palette.surface,
          transform: [{ scale: pressed ? 0.992 : 1 }],
          ...raisedShadow('sm'),
          ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : {}),
        },
        focusRing(focused),
        style,
      ]}
    >
      <CategoryArt
        category={item.category}
        size={horizontal ? 112 : compact ? 88 : 132}
        style={horizontal ? undefined : { width: '100%' }}
      />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="micro" color={palette.muted}>
              {getCategoryLabel(item.category).toUpperCase()}
            </AppText>
            <AppText variant="h3" numberOfLines={2}>
              {item.title}
            </AppText>
          </View>
          <ArrowUpRight aria-hidden color={palette.wine} size={20} strokeWidth={2.2} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <StatusPill kind={item.kind} />
          {item.status !== 'published' ? <StatusPill status={item.status} /> : null}
        </View>

        <View style={{ gap: spacing.xs, marginTop: 'auto' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <MapPin aria-hidden color={palette.muted} size={16} strokeWidth={2} />
            <AppText variant="support" color={palette.inkSoft} numberOfLines={1} style={{ flex: 1 }}>
              {item.location}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Clock3 aria-hidden color={urgent ? palette.danger : palette.muted} size={16} strokeWidth={2} />
            <AppText variant="support" color={urgent ? palette.danger : palette.inkSoft}>
              {item.kind === 'found' ? handoffLabel(itemForTime, now) : `Posted ${formatDate(item.createdAt)}`}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
