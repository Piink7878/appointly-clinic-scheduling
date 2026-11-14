// ==============================================================================
// Appointly Server — Timezone & UTC Conversion Utilities
// ==============================================================================
// Reference: System-Level SDS Section 3.1 & 8.2 (DEC-016)
// Provides bidirectional conversion between UTC timestamps and Clinic Local Time (Asia/Bangkok).
// ==============================================================================

export const CLINIC_TIMEZONE = 'Asia/Bangkok';
export const BANGKOK_TIMEZONE = 'Asia/Bangkok';

/**
 * Validates whether a given string is a valid IANA timezone identifier.
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures input is a valid Date instance.
 */
function ensureDate(dateInput: Date | string | number): Date {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date provided: ${String(dateInput)}`);
  }
  return date;
}

/**
 * Formats a UTC Date to an ISO string representation in the specified timezone.
 */
export function formatUtcToTimezone(
  utcDate: Date | string,
  timezone: string = BANGKOK_TIMEZONE
): string {
  const date = ensureDate(utcDate);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = p.value;
    }
  }

  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`;
}

/**
 * Returns formatted Date string (YYYY-MM-DD) in Bangkok local time.
 */
export function toBangkokDateString(utcDate: Date | string): string {
  const date = ensureDate(utcDate);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Resolves user input to the clinic-local CALENDAR date (YYYY-MM-DD), or null when invalid.
 *  - "YYYY-MM-DD" is taken as that calendar date. It must be a real date: "2026-02-30"
 *    is rejected instead of silently rolling over to 2026-03-02.
 *  - A full timestamp (or Date) is converted to the Asia/Bangkok date it falls on, so
 *    "2026-12-25T01:00:00+07:00" is 25 December, not the UTC date 24 December.
 */
export function parseClinicCalendarDate(input: string | Date): string | null {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (plain) {
      const [year, month, day] = [Number(plain[1]), Number(plain[2]), Number(plain[3])];
      const probe = new Date(Date.UTC(year, month - 1, day));
      const isRealDate =
        probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
      return isRealDate ? trimmed : null;
    }
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 1900 || year > 9999) return null;
  return toBangkokDateString(date);
}

/**
 * Returns formatted Time string (HH:mm:ss) in Bangkok local time.
 */
export function toBangkokTimeString(utcDate: Date | string): string {
  const date = ensureDate(utcDate);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * Returns formatted Date & Time string (YYYY-MM-DD HH:mm:ss) in Bangkok local time.
 */
export function toBangkokDateTimeString(utcDate: Date | string): string {
  return `${toBangkokDateString(utcDate)} ${toBangkokTimeString(utcDate)}`;
}

/**
 * Parses a Bangkok calendar date (YYYY-MM-DD) and optional time (HH:mm or HH:mm:ss)
 * into a UTC JavaScript Date instance.
 */
export function parseBangkokToUtc(dateStr: string, timeStr = '00:00:00'): Date {
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const isoWithOffset = `${dateStr}T${normalizedTime}+07:00`;
  const parsed = new Date(isoWithOffset);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Failed to parse Bangkok date/time: ${dateStr} ${timeStr}`);
  }
  return parsed;
}

/**
 * Converts a UTC Date to a new Date representation shifted by +7 hours for calculation.
 */
export function utcToBangkokDate(utcDate: Date | string): Date {
  const date = ensureDate(utcDate);
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
}

/**
 * Converts a Bangkok-shifted Date representation back to a UTC Date.
 */
export function bangkokToUtcDate(bangkokDate: Date | string): Date {
  const date = ensureDate(bangkokDate);
  return new Date(date.getTime() - 7 * 60 * 60 * 1000);
}

