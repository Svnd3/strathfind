import { describe, expect, it } from 'vitest';

import { createHandoffDeadline, filterItems, hoursUntil, maskPhone } from './item-utils';
import { initialItems } from './mock-data';

describe('privacy and discovery helpers', () => {
  it('masks contact numbers while preserving only useful edges', () => {
    expect(maskPhone('+254 712 884 042')).toBe('25••••••••42');
  });

  it('filters by text, kind, and category', () => {
    expect(filterItems(initialItems, 'library', 'found', 'electronics')).toHaveLength(1);
    expect(filterItems(initialItems, '', 'lost', 'all').every((item) => item.kind === 'lost')).toBe(true);
  });

  it('sets the custody deadline 24 hours after the found time', () => {
    const found = new Date('2026-08-22T08:00:00.000Z');
    expect(createHandoffDeadline(found)).toBe('2026-08-23T08:00:00.000Z');
    expect(hoursUntil('2026-08-23T08:00:00.000Z', found)).toBe(24);
  });
});
