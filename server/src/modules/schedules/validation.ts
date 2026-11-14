// ==============================================================================
// Appointly Server — Schedule Validation Schemas
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2 & Sprint 1 Contracts (F-006, F-007)
// Provides Zod request payload validation schemas for weekly shifts and exceptions.
// ==============================================================================

import { z } from 'zod';
import { ExceptionType } from '@prisma/client';
import { parseClinicCalendarDate } from '../../shared/utils/timezone';

/**
 * Validates a single weekly shift window item.
 */
export const shiftSchema = z.object({
  scheduleId: z.string().uuid().optional(),
  dayOfWeek: z.number({
    required_error: 'dayOfWeek is required',
    invalid_type_error: 'dayOfWeek must be an integer between 0 and 6',
  })
    .int('dayOfWeek must be an integer')
    .min(0, 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)')
    .max(6, 'dayOfWeek must be between 0 (Sunday) and 6 (Saturday)'),
  startTime: z
    .string({ required_error: 'startTime is required' })
    .trim()
    .min(1, 'startTime must not be empty'),
  endTime: z
    .string({ required_error: 'endTime is required' })
    .trim()
    .min(1, 'endTime must not be empty'),
  isActive: z.boolean().optional().default(true),
});

export type ShiftSchemaInput = z.infer<typeof shiftSchema>;

/**
 * Validates weekly shifts update payload.
 * Accepts:
 *   - { schedules: ShiftInput[] }
 *   - { shifts: ShiftInput[] }
 *   - { weeklySchedules: ShiftInput[] }
 *   - ShiftInput[] (direct array)
 */
export const updateScheduleSchema = z.union([
  z.object({
    schedules: z.array(shiftSchema),
    reason: z.string().trim().max(255).optional(),
    overrideReason: z.string().trim().max(255).optional(),
  }),
  z.object({
    shifts: z.array(shiftSchema),
    reason: z.string().trim().max(255).optional(),
    overrideReason: z.string().trim().max(255).optional(),
  }),
  z.object({
    weeklySchedules: z.array(shiftSchema),
    reason: z.string().trim().max(255).optional(),
    overrideReason: z.string().trim().max(255).optional(),
  }),
  z.array(shiftSchema),
]);

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

/**
 * Helper to normalize parsed updateSchedule input into a flat ShiftSchemaInput[] array.
 */
export function extractShiftsFromInput(input: UpdateScheduleInput): ShiftSchemaInput[] {
  if (Array.isArray(input)) {
    return input;
  }
  if ('schedules' in input && Array.isArray(input.schedules)) {
    return input.schedules;
  }
  if ('shifts' in input && Array.isArray(input.shifts)) {
    return input.shifts;
  }
  if ('weeklySchedules' in input && Array.isArray(input.weeklySchedules)) {
    return input.weeklySchedules;
  }
  return [];
}

/**
 * Validates schedule exception creation: POST /api/v1/doctors/me/exceptions
 */
export const createExceptionSchema = z.object({
  exceptionDate: z
    .union([z.string(), z.date()], {
      required_error: 'exceptionDate is required',
    })
    .refine((val) => parseClinicCalendarDate(val) !== null, 'exceptionDate must be a valid calendar date (YYYY-MM-DD)'),
  exceptionType: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase().trim() : val),
    z.nativeEnum(ExceptionType, {
      errorMap: () => ({
        message: "exceptionType must be 'HOLIDAY', 'BREAK', 'UNAVAILABLE', or 'CUSTOM_HOURS'",
      }),
    })
  ),
  startTime: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === '' ? null : v.trim())),
  endTime: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === '' ? null : v.trim())),
  reason: z
    .string()
    .trim()
    .max(255, 'reason must not exceed 255 characters')
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === '' ? null : v.trim())),
});

export type CreateExceptionInput = z.infer<typeof createExceptionSchema>;

