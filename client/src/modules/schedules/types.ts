// ==============================================================================
// Appointly Client — Doctor Schedule Types
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6 (F-006) — camelCase DTOs returned by
// GET/PUT /api/v1/doctors/me/schedule and POST/DELETE /doctors/me/exceptions.
// ==============================================================================

export type ExceptionType = 'HOLIDAY' | 'BREAK' | 'UNAVAILABLE' | 'CUSTOM_HOURS';

/** One recurring weekly working window. `dayOfWeek`: 0 = Sunday … 6 = Saturday. */
export interface WeeklyShift {
  scheduleId?: string;
  dayOfWeek: number;
  /** "HH:mm" or "HH:mm:ss" (clinic timezone). */
  startTime: string;
  endTime: string;
  isActive: boolean;
}

/** Body item of PUT /doctors/me/schedule. */
export interface ShiftInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface ScheduleException {
  exceptionId: string;
  /** ISO datetime of a calendar DATE, e.g. "2026-12-31T00:00:00.000Z". */
  exceptionDate: string;
  /** Both null = full day. */
  startTime: string | null;
  endTime: string | null;
  exceptionType: ExceptionType;
  reason: string | null;
}

export interface MySchedule {
  weeklySchedules: WeeklyShift[];
  exceptions: ScheduleException[];
}

export interface CreateExceptionInput {
  /** "YYYY-MM-DD" */
  exceptionDate: string;
  exceptionType: ExceptionType;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}
