export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'Asia/Bangkok',
  });
};

/**
 * Converts an API date value (e.g. "1995-05-15T00:00:00.000Z" or "1995-05-15")
 * into the "YYYY-MM-DD" form required by <input type="date">.
 *
 * Patient.date_of_birth is a calendar DATE that the API serialises as UTC
 * midnight, so we take the leading date part verbatim instead of converting
 * through the browser's local timezone (which could shift the day).
 */
export const toDateInputValue = (value: string | null | undefined): string => {
  if (!value) return '';
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return match ? match[0] : '';
};

/** Current calendar date (YYYY-MM-DD) in the clinic timezone (Asia/Bangkok). */
const bangkokDateString = (now: Date): string =>
  now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

/**
 * Latest selectable date of birth (YYYY-MM-DD).
 *
 * Contract F-002: dateOfBirth must be *strictly* in the past. The backend
 * rejects any date that is not before both the Asia/Bangkok calendar date and
 * the UTC calendar date, so the picker's `max` is the day before the earlier of
 * the two. Bangkok is UTC+7, so the UTC date is the earlier one (or equal).
 */
export const getMaxDobDate = (now: Date = new Date()): string => {
  const bangkokToday = bangkokDateString(now);
  const utcToday = now.toISOString().slice(0, 10);
  const earliestToday = bangkokToday < utcToday ? bangkokToday : utcToday;

  const [year, month, day] = earliestToday.split('-').map(Number);
  const previousDay = new Date(Date.UTC(year, month - 1, day - 1));
  return previousDay.toISOString().slice(0, 10);
};
