// ==============================================================================
// Appointly Client — Schedule Drafts, Validation & Formatting
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6 (F-006), AC-F006-01/02/03.
// Mirrors server/src/modules/schedules/scheduleValidator.ts:
//   - every shift: startTime < endTime (14:00–10:00 and 10:00–10:00 are rejected)
//   - active shifts on the same day must not overlap: a.start < b.end && b.start < a.end
//     (back-to-back 09:00–12:00 + 12:00–15:00 is allowed; inactive shifts are ignored)
//   - exception: full day (no times) or a window with startTime < endTime
// The server stays the authority (422 INVALID_SCHEDULE_WINDOW); these checks give
// instant, row-level feedback.
// ==============================================================================

import { type CreateExceptionInput, type ExceptionType, type ScheduleException, type ShiftInput, type WeeklyShift } from './types';

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const REASON_MAX_LENGTH = 255;

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** "09:00:00" / "09:00" -> "09:00" (the value `<input type="time">` expects); anything else -> "". */
export const toTimeInput = (value: string | null | undefined): string => {
  if (!value) return '';
  const match = TIME_PATTERN.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : '';
};

/** Minutes after midnight for "HH:mm", or NaN when the text is not a valid time. */
export const toMinutes = (value: string): number => {
  const match = TIME_PATTERN.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};

const fromMinutes = (total: number): string =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

export const formatTimeRange = (start: string | null, end: string | null): string =>
  start && end ? `${toTimeInput(start)}–${toTimeInput(end)}` : 'Full day';

// ---------------------------------------------------------------------------
// Weekly schedule draft
// ---------------------------------------------------------------------------
export interface SlotDraft {
  /** Stable React key; not sent to the API. */
  key: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

/** Index = dayOfWeek (0 = Sunday … 6 = Saturday). */
export type WeekDraft = SlotDraft[][];

let slotCounter = 0;
export const newSlotKey = (): string => `slot-${++slotCounter}`;

export const emptyWeek = (): WeekDraft => DAY_NAMES.map(() => []);

const byStart = (a: SlotDraft, b: SlotDraft): number => {
  const x = toMinutes(a.startTime);
  const y = toMinutes(b.startTime);
  if (Number.isNaN(x) || Number.isNaN(y)) return 0;
  return x - y;
};

export function shiftsToDraft(shifts: WeeklyShift[]): WeekDraft {
  const week = emptyWeek();
  for (const shift of shifts) {
    if (!Number.isInteger(shift.dayOfWeek) || shift.dayOfWeek < 0 || shift.dayOfWeek > 6) continue;
    week[shift.dayOfWeek].push({
      key: newSlotKey(),
      startTime: toTimeInput(shift.startTime),
      endTime: toTimeInput(shift.endTime),
      // Keep inactive shifts: dropping them on save would silently delete them.
      isActive: shift.isActive !== false,
    });
  }
  return week.map((day) => [...day].sort(byStart));
}

/** Request body: every slot of every day (the PUT replaces the whole schedule). */
export function draftToPayload(week: WeekDraft): ShiftInput[] {
  return week.flatMap((slots, dayOfWeek) =>
    slots.map((slot) => ({
      dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isActive: slot.isActive,
    }))
  );
}

export const isWeekDirty = (draft: WeekDraft, baseline: WeekDraft): boolean =>
  JSON.stringify(draftToPayload(draft)) !== JSON.stringify(draftToPayload(baseline));

/** A sensible next slot: 09:00–12:00 first, then a lunch gap and four hours (13:00–17:00). */
export function suggestSlot(existing: SlotDraft[]): Pick<SlotDraft, 'startTime' | 'endTime'> {
  const ends = existing.map((s) => toMinutes(s.endTime)).filter((m) => !Number.isNaN(m));
  if (existing.length === 0) return { startTime: '09:00', endTime: '12:00' };
  if (ends.length === 0) return { startTime: '', endTime: '' };

  const start = Math.max(...ends) + 60;
  if (start >= 23 * 60) return { startTime: '', endTime: '' };
  return { startTime: fromMinutes(start), endTime: fromMinutes(Math.min(start + 240, 23 * 60 + 59)) };
}

export interface WeekErrors {
  /** slot.key -> message */
  slots: Record<string, string>;
  count: number;
}

export function validateWeek(week: WeekDraft): WeekErrors {
  const slots: Record<string, string> = {};

  week.forEach((day) => {
    // 1. Each slot needs a valid, ordered window.
    for (const slot of day) {
      if (!slot.startTime || !slot.endTime) {
        slots[slot.key] = 'Start and end time are required.';
        continue;
      }
      const start = toMinutes(slot.startTime);
      const end = toMinutes(slot.endTime);
      if (Number.isNaN(start) || Number.isNaN(end)) slots[slot.key] = 'Enter a valid time (HH:mm).';
      else if (start >= end) slots[slot.key] = 'End time must be after start time.';
    }

    // 2. Active, individually valid slots must not overlap (touching ends are fine).
    const valid = day.filter((s) => s.isActive && !slots[s.key]);
    for (let i = 0; i < valid.length; i += 1) {
      for (let j = i + 1; j < valid.length; j += 1) {
        const a = valid[i];
        const b = valid[j];
        if (toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)) {
          const later = toMinutes(a.startTime) <= toMinutes(b.startTime) ? b : a;
          const earlier = later === a ? b : a;
          if (!slots[later.key]) {
            slots[later.key] = `Overlaps with ${earlier.startTime}–${earlier.endTime}.`;
          }
        }
      }
    }
  });

  return { slots, count: Object.keys(slots).length };
}

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------
export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  HOLIDAY: 'Holiday',
  BREAK: 'Break',
  UNAVAILABLE: 'Unavailable',
  CUSTOM_HOURS: 'Custom hours',
};

export const EXCEPTION_TYPES = Object.keys(EXCEPTION_TYPE_LABELS) as ExceptionType[];

/** Contract §1.6: only a HOLIDAY may block the whole day; other types need a time window. */
export const allowsFullDay = (type: ExceptionType): boolean => type === 'HOLIDAY';

export interface ExceptionFormValues {
  exceptionDate: string;
  exceptionType: ExceptionType;
  fullDay: boolean;
  startTime: string;
  endTime: string;
  reason: string;
}

export type ExceptionFormErrors = Partial<Record<keyof ExceptionFormValues, string>>;

export const emptyExceptionForm = (): ExceptionFormValues => ({
  exceptionDate: '',
  exceptionType: 'HOLIDAY',
  fullDay: true,
  startTime: '',
  endTime: '',
  reason: '',
});

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/**
 * `today` is the clinic-local date (YYYY-MM-DD); past dates cannot be scheduled.
 * `reasonRequired` is used for administrator overrides, which must carry an audit reason (SDS 6.1).
 */
export function validateExceptionForm(
  values: ExceptionFormValues,
  today: string,
  options: { reasonRequired?: boolean } = {}
): ExceptionFormErrors {
  const errors: ExceptionFormErrors = {};

  if (!values.exceptionDate) errors.exceptionDate = 'Date is required.';
  else if (!isRealDate(values.exceptionDate)) errors.exceptionDate = 'Enter a valid date.';
  else if (values.exceptionDate < today) errors.exceptionDate = 'Choose today or a future date.';

  const fullDay = allowsFullDay(values.exceptionType) && values.fullDay;
  if (!fullDay) {
    const start = toMinutes(values.startTime);
    const end = toMinutes(values.endTime);
    if (!values.startTime) errors.startTime = 'Start time is required.';
    else if (Number.isNaN(start)) errors.startTime = 'Enter a valid time (HH:mm).';
    if (!values.endTime) errors.endTime = 'End time is required.';
    else if (Number.isNaN(end)) errors.endTime = 'Enter a valid time (HH:mm).';
    if (!errors.startTime && !errors.endTime && start >= end) errors.endTime = 'End time must be after start time.';
  }

  if (options.reasonRequired && !values.reason.trim()) errors.reason = 'A reason is required for this change.';
  else if (values.reason.trim().length > REASON_MAX_LENGTH)
    errors.reason = `Reason must not exceed ${REASON_MAX_LENGTH} characters.`;

  return errors;
}

export function toExceptionPayload(values: ExceptionFormValues): CreateExceptionInput {
  const fullDay = allowsFullDay(values.exceptionType) && values.fullDay;
  return {
    exceptionDate: values.exceptionDate,
    exceptionType: values.exceptionType,
    startTime: fullDay ? null : values.startTime,
    endTime: fullDay ? null : values.endTime,
    reason: values.reason.trim() || null,
  };
}

/** Upcoming first: by date, then by start time (full-day entries first). */
export const sortExceptions = (list: ScheduleException[]): ScheduleException[] =>
  [...list].sort((a, b) => {
    const byDate = a.exceptionDate.slice(0, 10).localeCompare(b.exceptionDate.slice(0, 10));
    if (byDate !== 0) return byDate;
    return toTimeInput(a.startTime).localeCompare(toTimeInput(b.startTime));
  });
