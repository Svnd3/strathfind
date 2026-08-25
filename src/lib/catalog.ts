import type { ItemCategory } from './types';

export const categories: readonly ItemCategory[] = [
  'electronics',
  'identity',
  'keys',
  'bags',
  'clothing',
  'books',
  'bottles',
  'other',
] as const;

export const handoffPoints = [
  'Student Centre desk',
  'Main gate security desk',
  'Sports office reception',
] as const;
