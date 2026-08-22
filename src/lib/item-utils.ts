import type { LostFoundItem } from './types';

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return 'Hidden';
  const prefix = digits.slice(0, Math.min(2, digits.length - 2));
  const suffix = digits.slice(-2);
  return `${prefix}${'•'.repeat(Math.max(4, digits.length - prefix.length - suffix.length))}${suffix}`;
}

export function hoursUntil(iso: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 3_600_000));
}

type HandoffItem = Pick<LostFoundItem, 'kind' | 'handoffDueAt' | 'status'>;

export function handoffLabel(item: HandoffItem, now = new Date()): string {
  if (item.kind === 'lost' || !item.handoffDueAt) return 'Open report';
  if (item.status === 'at_office') return 'At lost & found';
  if (item.status === 'returned') return 'Returned';
  const hours = hoursUntil(item.handoffDueAt, now);
  return hours === 0 ? 'Handoff due now' : `${hours}h to handoff`;
}

export function isHandoffUrgent(item: HandoffItem, now = new Date()): boolean {
  return item.kind === 'found' && Boolean(item.handoffDueAt) && hoursUntil(item.handoffDueAt!, now) <= 6;
}

type FilterableItem = Pick<
  LostFoundItem,
  'title' | 'description' | 'location' | 'color' | 'category' | 'kind'
>;

export function filterItems<T extends FilterableItem>(
  items: T[],
  query: string,
  kind: 'all' | LostFoundItem['kind'],
  category: 'all' | LostFoundItem['category'],
): T[] {
  const normalized = query.trim().toLowerCase();
  return items.filter((item) => {
    const matchesKind = kind === 'all' || item.kind === kind;
    const matchesCategory = category === 'all' || item.category === category;
    const haystack = `${item.title} ${item.description} ${item.location} ${item.color} ${item.category}`.toLowerCase();
    return matchesKind && matchesCategory && (!normalized || haystack.includes(normalized));
  });
}

export function createHandoffDeadline(foundAt: Date): string {
  return new Date(foundAt.getTime() + 24 * 3_600_000).toISOString();
}
