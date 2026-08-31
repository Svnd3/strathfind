import { describe, expect, it } from 'vitest';

import {
  createHandoffDeadline,
  filterItems,
  handoffLabel,
  hoursUntil,
  isHandoffUrgent,
  isRecentlyReturned,
  maskPhone,
} from './item-utils';
import type { LostFoundItem } from './types';

const filterFixtures: LostFoundItem[] = [
  {
    id: 'found-fixture',
    kind: 'found',
    title: 'Test calculator',
    category: 'electronics',
    color: 'Black',
    description: 'Fixture used only by the filter unit test.',
    location: 'Library test location',
    foundAt: '2026-08-22T08:00:00.000Z',
    status: 'published',
    holderName: 'Test holder',
    holderPhone: '+254700000000',
    createdAt: '2026-08-22T08:00:00.000Z',
  },
  {
    id: 'lost-fixture',
    kind: 'lost',
    title: 'Test notebook',
    category: 'books',
    color: 'Blue',
    description: 'Fixture used only by the filter unit test.',
    location: 'Test location',
    foundAt: '2026-08-22T08:00:00.000Z',
    status: 'published',
    holderName: 'Test holder',
    holderPhone: '+254700000000',
    createdAt: '2026-08-22T08:00:00.000Z',
  },
];

describe('privacy and discovery helpers', () => {
  it('masks contact numbers while preserving only useful edges', () => {
    expect(maskPhone('+254 712 884 042')).toBe('25••••••••42');
  });

  it('filters by text, kind, and category', () => {
    expect(filterItems(filterFixtures, 'library', 'found', 'electronics')).toHaveLength(1);
    expect(filterItems(filterFixtures, '', 'lost', 'all').every((item) => item.kind === 'lost')).toBe(true);
  });

  it('sets the custody deadline 24 hours after the found time', () => {
    const found = new Date('2026-08-22T08:00:00.000Z');
    expect(createHandoffDeadline(found)).toBe('2026-08-23T08:00:00.000Z');
    expect(hoursUntil('2026-08-23T08:00:00.000Z', found)).toBe(24);
  });

  it('keeps reunited items visible for less than 72 hours only', () => {
    const returned = { status: 'returned' as const, returnedAt: '2026-08-28T12:00:00.000Z' };
    expect(isRecentlyReturned(returned, new Date('2026-08-31T11:59:59.999Z'))).toBe(true);
    expect(isRecentlyReturned(returned, new Date('2026-08-31T12:00:00.000Z'))).toBe(false);
    expect(isRecentlyReturned({ status: 'published' }, new Date('2026-08-29T12:00:00.000Z'))).toBe(false);
  });

  it('labels returned reports as returned regardless of their original kind', () => {
    expect(handoffLabel({ kind: 'lost', status: 'returned' })).toBe('Returned');
    expect(handoffLabel({ kind: 'found', status: 'returned' })).toBe('Returned');
  });

  it('uses desk-focused deadline copy', () => {
    const now = new Date('2026-08-31T12:00:00.000Z');
    expect(handoffLabel({
      kind: 'found',
      status: 'handoff_due',
      handoffDueAt: '2026-08-31T12:00:00.000Z',
    }, now)).toBe('Take to desk now');
    expect(handoffLabel({
      kind: 'found',
      status: 'published',
      handoffDueAt: '2026-08-31T17:00:00.000Z',
    }, now)).toBe('5h to desk');
  });

  it('only marks active found-item deadlines within six hours as urgent', () => {
    const now = new Date('2026-08-31T12:00:00.000Z');
    const fiveHoursAway = '2026-08-31T17:00:00.000Z';
    const sevenHoursAway = '2026-08-31T19:00:00.000Z';

    expect(isHandoffUrgent({ kind: 'found', status: 'published', handoffDueAt: fiveHoursAway }, now)).toBe(true);
    expect(isHandoffUrgent({ kind: 'found', status: 'published', handoffDueAt: sevenHoursAway }, now)).toBe(false);
    expect(isHandoffUrgent({ kind: 'lost', status: 'published', handoffDueAt: fiveHoursAway }, now)).toBe(false);
    expect(isHandoffUrgent({ kind: 'found', status: 'at_office', handoffDueAt: fiveHoursAway }, now)).toBe(false);
    expect(isHandoffUrgent({ kind: 'found', status: 'returned', handoffDueAt: fiveHoursAway }, now)).toBe(false);
  });
});
