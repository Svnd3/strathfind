import type { ItemCategory } from './types';

export interface ReportStepValues {
  category: ItemCategory | null;
  title: string;
  color: string;
  location: string;
  privateClue: string;
  occurrenceDate: string;
  occurrenceTime: string;
}

/** Parse a local form date without allowing JavaScript to normalise impossible dates. */
export function parseReportOccurrence(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const value = new Date(year, month - 1, day, hour, minute, 0, 0);
  const componentsMatch = value.getFullYear() === year
    && value.getMonth() === month - 1
    && value.getDate() === day
    && value.getHours() === hour
    && value.getMinutes() === minute;

  return componentsMatch ? value : null;
}

export function validateReportStep(
  step: 0 | 1,
  values: ReportStepValues,
  now = new Date(),
): string | null {
  if (step === 0 && (
    !values.category
    || values.title.trim().length < 2
    || values.color.trim().length < 2
  )) {
    return 'Choose a category, then add a short title and colour.';
  }

  if (step === 1 && (
    values.location.trim().length < 2
    || values.privateClue.trim().length < 5
  )) {
    return 'Add a location and a useful private clue.';
  }

  if (step === 1) {
    const occurredAt = parseReportOccurrence(values.occurrenceDate, values.occurrenceTime);
    if (!occurredAt || occurredAt.getTime() > now.getTime() + 5 * 60_000) {
      return 'Enter a valid date and time that is not in the future.';
    }
  }

  return null;
}
