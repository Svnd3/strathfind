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

import { radius, type AppPalette } from '@/constants/design';
import type { ItemCategory } from '@/lib/types';
import { useAppTheme } from '@/theme/app-theme';

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

function getCategoryColors(colors: AppPalette): Record<ItemCategory, { background: string; foreground: string }> {
  return {
    electronics: { background: colors.blueSoft, foreground: colors.blue },
    identity: { background: colors.warningSoft, foreground: colors.warning },
    keys: { background: colors.wineSoft, foreground: colors.wine },
    bags: { background: colors.wineSoft, foreground: colors.wine },
    clothing: { background: colors.warningSoft, foreground: colors.warning },
    books: { background: colors.successSoft, foreground: colors.success },
    bottles: { background: colors.tealSoft, foreground: colors.teal },
    other: { background: colors.inset, foreground: colors.inkSoft },
  };
}

export interface CategoryArtProps {
  category: ItemCategory;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** A semantic category illustration; it is intentional UI, never a missing-image placeholder. */
export function CategoryArt({ category, size = 104, style }: CategoryArtProps) {
  const { colors: themeColors } = useAppTheme();
  const Icon = categoryIcons[category];
  const colors = getCategoryColors(themeColors)[category];
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
