// ==============================================================================
// Appointly Server — Doctor Schedule Domain Validation Helper
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 5.3 & Sprint 1 Contracts (F-006)
// Enforces domain rules for doctor working schedules and leaves:
//   - Strict time format validation: HH:mm or HH:mm:ss
//   - Inverted window validation: startTime < endTime (startTime >= endTime rejected with 422 INVALID_SCHEDULE_WINDOW)
//   - Same-day shift overlap validation: strict overlap prohibited (existing.start < new.end && new.start < existing.end)
//   - Back-to-back shifts permitted: e.g. 09:00–12:00 and 12:00–15:00 are non-overlapping
//   - Schedule exception validation: full-day holidays vs. partial-day leave windows
// ==============================================================================

import { AppError } from '../../shared/middleware/errorHandler';
import { parseClinicCalendarDate } from '../../shared/utils/timezone';

/**
 * Standard Shift input interface.
 */
export interface ShiftInput {
  scheduleId?: string;
  doctorId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

/**
 * Standard Exception input interface.
 */
export interface ExceptionInput {
  exceptionDate: string | Date;
  exceptionType: 'HOLIDAY' | 'BREAK' | 'UNAVAILABLE' | 'CUSTOM_HOURS' | string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
}

/**
 * Strict 24-hour time regex accepting HH:mm or HH:mm:ss.
 * Hours: 00-23, Minutes: 00-59, Seconds (optional): 00-59.
 */
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/**
 * Validates whether a time string matches HH:mm or HH:mm:ss format.
 */
export function isValidTimeFormat(time: string): boolean {
  if (typeof time !== 'string') return false;
  return TIME_REGEX.test(time.trim());
}

/**
 * Parses a valid HH:mm or HH:mm:ss time string into seconds from midnight (0..86399).
 * Throws 422 Unprocessable Entity with code 'INVALID_SCHEDULE_WINDOW' if format is invalid.
 */
export function parseTimeToSeconds(timeStr: string): number {
  if (typeof timeStr !== 'string') {
    throw AppError.unprocessable(
      `Invalid time value: expected string, got ${typeof timeStr}.`,
      'INVALID_SCHEDULE_WINDOW'
    );
  }

  const trimmed = timeStr.trim();
  const match = trimmed.match(TIME_REGEX);
  if (!match) {
    throw AppError.unprocessable(
      `Invalid time format: "${timeStr}". Expected HH:mm or HH:mm:ss format.`,
      'INVALID_SCHEDULE_WINDOW'
    );
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] !== undefined ? parseInt(match[3], 10) : 0;

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Normalizes time string by trimming whitespace.
 */
export function normalizeTime(time: string): string {
  if (!isValidTimeFormat(time)) {
    throw AppError.unprocessable(
      `Invalid time format: "${time}". Expected HH:mm or HH:mm:ss format.`,
      'INVALID_SCHEDULE_WINDOW'
    );
  }
  return time.trim();
}

/**
 * Validates that startTime < endTime for a given time window.
 * If startTime >= endTime (e.g., 14:00–10:00 or 10:00–10:00),
 * rejects with 422 Unprocessable Entity, code: 'INVALID_SCHEDULE_WINDOW'.
 */
export function validateTimeWindow(startTime: string, endTime: string): void {
  const startSec = parseTimeToSeconds(startTime);
  const endSec = parseTimeToSeconds(endTime);

  if (startSec >= endSec) {
    throw AppError.unprocessable(
      `Schedule window start time (${startTime}) must be strictly earlier than end time (${endTime}).`,
      'INVALID_SCHEDULE_WINDOW'
    );
  }
}

/**
 * Checks whether two shifts overlap strictly.
 * Overlap condition:
 *   existing.startTime < new.endTime && new.startTime < existing.endTime
 * Back-to-back shifts (e.g. 09:00–12:00 and 12:00–15:00) share an endpoint and do NOT overlap.
 */
export function doShiftsOverlap(
  shift1: { startTime: string; endTime: string },
  shift2: { startTime: string; endTime: string }
): boolean {
  const s1 = parseTimeToSeconds(shift1.startTime);
  const e1 = parseTimeToSeconds(shift1.endTime);
  const s2 = parseTimeToSeconds(shift2.startTime);
  const e2 = parseTimeToSeconds(shift2.endTime);

  // Strict overlap condition: s1 < e2 && s2 < e1
  return s1 < e2 && s2 < e1;
}

/**
 * Validates an array of weekly shifts:
 *   1. Each shift must have dayOfWeek between 0 (Sunday) and 6 (Saturday).
 *   2. Each shift must have valid time formats and startTime < endTime.
 *   3. No two active shifts on the same dayOfWeek may overlap (strict overlap prohibited).
 *      Back-to-back shifts are permitted.
 * Throws 422 Unprocessable Entity with code 'INVALID_SCHEDULE_WINDOW' upon any window violation.
 */
export function validateShifts(shifts: ShiftInput[]): void {
  if (!Array.isArray(shifts)) {
    throw AppError.badRequest('Shifts must be an array.', 'INVALID_PAYLOAD');
  }

  // 1. Validate individual shift structures, dayOfWeek range, and time windows
  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    if (
      shift.dayOfWeek === undefined ||
      shift.dayOfWeek === null ||
      typeof shift.dayOfWeek !== 'number' ||
      !Number.isInteger(shift.dayOfWeek) ||
      shift.dayOfWeek < 0 ||
      shift.dayOfWeek > 6
    ) {
      throw AppError.badRequest(
        `Invalid dayOfWeek at index ${i}: must be an integer between 0 (Sunday) and 6 (Saturday).`,
        'INVALID_DAY_OF_WEEK'
      );
    }

    // Validates time format and ensures startTime < endTime
    validateTimeWindow(shift.startTime, shift.endTime);
  }

  // 2. Group active shifts by dayOfWeek to check for overlaps
  // Inactive shifts (isActive === false) do not participate in active schedule collisions
  const shiftsByDay = new Map<number, ShiftInput[]>();
  for (const shift of shifts) {
    if (shift.isActive !== false) {
      const dayList = shiftsByDay.get(shift.dayOfWeek) || [];
      dayList.push(shift);
      shiftsByDay.set(shift.dayOfWeek, dayList);
    }
  }

  // 3. Check for pairwise overlap on the same dayOfWeek
  for (const [day, dayShifts] of shiftsByDay.entries()) {
    for (let i = 0; i < dayShifts.length; i++) {
      for (let j = i + 1; j < dayShifts.length; j++) {
        if (doShiftsOverlap(dayShifts[i], dayShifts[j])) {
          throw AppError.unprocessable(
            `Schedule windows on the same day (${day}) must not overlap: [${dayShifts[i].startTime}–${dayShifts[i].endTime}] and [${dayShifts[j].startTime}–${dayShifts[j].endTime}].`,
            'INVALID_SCHEDULE_WINDOW'
          );
        }
      }
    }
  }
}

/**
 * Validates a single schedule exception.
 * Full-day exceptions (e.g. HOLIDAY with startTime = null, endTime = null) are permitted.
 * Partial-day exceptions must have both startTime and endTime specified with startTime < endTime.
 */
export function validateException(exception: ExceptionInput): void {
  if (!exception) {
    throw AppError.badRequest('Exception payload is required.', 'INVALID_PAYLOAD');
  }

  // 1. Validate exceptionDate
  if (!exception.exceptionDate) {
    throw AppError.badRequest('exceptionDate is required.', 'INVALID_EXCEPTION_DATE');
  }

  if (parseClinicCalendarDate(exception.exceptionDate) === null) {
    throw AppError.badRequest(
      `Invalid exceptionDate: "${String(exception.exceptionDate)}".`,
      'INVALID_EXCEPTION_DATE'
    );
  }

  // 2. Validate exceptionType
  const validTypes = ['HOLIDAY', 'BREAK', 'UNAVAILABLE', 'CUSTOM_HOURS'];
  const typeUpper = String(exception.exceptionType || '').toUpperCase();
  if (!validTypes.includes(typeUpper)) {
    throw AppError.badRequest(
      `Invalid exceptionType: "${exception.exceptionType}". Allowed types: ${validTypes.join(', ')}.`,
      'INVALID_EXCEPTION_TYPE'
    );
  }

  // 3. Validate partial-day vs full-day windows
  const hasStart = exception.startTime !== undefined && exception.startTime !== null && String(exception.startTime).trim() !== '';
  const hasEnd = exception.endTime !== undefined && exception.endTime !== null && String(exception.endTime).trim() !== '';

  if (hasStart !== hasEnd) {
    throw AppError.unprocessable(
      'Both startTime and endTime must be provided together for partial-day exceptions.',
      'INVALID_SCHEDULE_WINDOW'
    );
  }

  if (hasStart && hasEnd) {
    validateTimeWindow(String(exception.startTime), String(exception.endTime));
  }

  // 4. Validate reason length if provided
  if (exception.reason && exception.reason.length > 255) {
    throw AppError.badRequest(
      'Exception reason must not exceed 255 characters.',
      'REASON_TOO_LONG'
    );
  }
}

export const scheduleValidator = {
  isValidTimeFormat,
  parseTimeToSeconds,
  normalizeTime,
  validateTimeWindow,
  doShiftsOverlap,
  validateShifts,
  validateException,
};

export default scheduleValidator;

