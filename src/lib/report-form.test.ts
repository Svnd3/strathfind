import { describe, expect, it } from 'vitest';

import { parseReportOccurrence, validateReportStep } from './report-form';

const completeValues = {
  category: 'electronics' as const,
  title: 'Earbuds case',
  color: 'Black',
  location: 'Student Centre',
  privateClue: 'Initials under the lid',
  occurrenceDate: '2026-08-31',
  occurrenceTime: '12:00',
};

describe('report form helpers', () => {
  it('parses a valid local date and time exactly', () => {
    const value = parseReportOccurrence('2026-08-31', '09:05');

    expect(value).not.toBeNull();
    expect(value?.getFullYear()).toBe(2026);
    expect(value?.getMonth()).toBe(7);
    expect(value?.getDate()).toBe(31);
    expect(value?.getHours()).toBe(9);
    expect(value?.getMinutes()).toBe(5);
  });

  it('rejects malformed and impossible local dates', () => {
    expect(parseReportOccurrence('2026-2-03', '09:00')).toBeNull();
    expect(parseReportOccurrence('2026-02-31', '09:00')).toBeNull();
    expect(parseReportOccurrence('2026-08-31', '24:00')).toBeNull();
  });

  it('validates required item details', () => {
    expect(validateReportStep(0, { ...completeValues, category: null })).toBe(
      'Choose a category, then add a short title and colour.',
    );
  });

  it('validates location, private clue, and future occurrence times', () => {
    const now = new Date(2026, 7, 31, 12, 0);
    expect(validateReportStep(1, { ...completeValues, privateClue: 'x' }, now)).toBe(
      'Add a location and a useful private clue.',
    );
    expect(validateReportStep(1, { ...completeValues, occurrenceTime: '12:06' }, now)).toBe(
      'Enter a valid date and time that is not in the future.',
    );
    expect(validateReportStep(1, completeValues, now)).toBeNull();
  });
});
