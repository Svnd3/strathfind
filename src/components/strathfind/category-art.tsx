import type { ComponentType } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Backpack,
  BookOpen,
  CircleHelp,
  CreditCard,
  CupSoda,
  KeyRound,
  Shirt,
  Smartphone,
  type LucideProps,
} from 'lucide-react-native';

import { palette, radius } from '@/constants/design';
import type { ItemCategory } from '@/lib/types';

const categoryIcons: Record<ItemCategory, ComponentType<LucideProps>> = {
  electronics: Smartphone,
  identity: CreditCard,
  keys: KeyRound,
  bags: Backpack,
  clothing: Shirt,
  books: BookOpen,
  bottles: CupSoda,
  other: CircleHelp,
};

const categoryLabels: Record<ItemCategory, string> = {
  electronics: 'Electronics',
  identity: 'Identity card',
  keys: 'Keys',
  bags: 'Bag',
  clothing: 'Clothing',
  books: 'Book',
  bottles: 'Bottle',
  other: 'Other item',
};

const categoryColors: Record<ItemCategory, { background: string; foreground: string }> = {
  electronics: { background: palette.blueSoft, foreground: palette.blue },
  identity: { background: palette.warningSoft, foreground: palette.warning },
  keys: { background: palette.wineSoft, foreground: palette.wine },
  bags: { background: '#E5E1F2', foreground: '#473A73' },
  clothing: { background: '#E7DDD6', foreground: '#694332' },
  books: { background: palette.successSoft, foreground: palette.success },
  bottles: { background: '#DCECEF', foreground: '#285A64' },
  other: { background: palette.inset, foreground: palette.inkSoft },
};

export interface CategoryArtProps {
  category: ItemCategory;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** A semantic category illustration; it is intentional UI, never a missing-image placeholder. */
export function CategoryArt({ category, size = 104, style }: CategoryArtProps) {
  const Icon = categoryIcons[category];
  const colors = categoryColors[category];
  const iconSize = Math.round(size * 0.42);

  return (
    <View
      accessibilityLabel={categoryLabels[category]}
      accessibilityRole="image"
      style={[
        {
          width: size,
          height: size,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.lg,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      <View
        aria-hidden
        style={{
          position: 'absolute',
          width: size * 0.72,
          height: size * 0.72,
          right: -size * 0.2,
          top: -size * 0.18,
          borderRadius: radius.pill,
          borderColor: colors.foreground,
          borderWidth: Math.max(1, Math.round(size * 0.025)),
          opacity: 0.12,
        }}
      />
      <Icon color={colors.foreground} size={iconSize} strokeWidth={1.8} />
    </View>
  );
}

export function getCategoryLabel(category: ItemCategory): string {
  return categoryLabels[category];
}
