// ==============================================================================
// Appointly Server — Clinic Settings Validation Schemas
// ==============================================================================
// Reference: System-Level SDS Section 3.2K, 5.2 & Sprint 1 Contracts (F-007)
// Enforces validation rules on Clinic Settings updates.
// ==============================================================================

import { z } from 'zod';
import { isValidTimezone } from '../../shared/utils/timezone';

export const ALLOWED_FIXED_START_INTERVALS = [5, 10, 15, 20, 30, 60] as const;

/**
 * Upper bound (one year) for hour-based settings. The contract only sets a lower
 * bound, but without a cap a huge value overflows the 32-bit database column and
 * surfaces as a 500 instead of a 400.
 */
export const MAX_SETTING_HOURS = 8760;

export const updateSettingsSchema = z.object({
  clinicName: z
    .preprocess(
      (val) => {
        if (val === undefined) return undefined;
        if (typeof val === 'string') return val.trim();
        return val;
      },
      z
        .string({
          invalid_type_error: 'clinicName must be a string',
        })
        .min(1, 'clinicName must be between 1 and 150 characters')
        .max(150, 'clinicName must be between 1 and 150 characters')
    )
    .optional(),

  timezone: z
    .preprocess(
      (val) => {
        if (val === undefined) return undefined;
        if (typeof val === 'string') return val.trim();
        return val;
      },
      z
        .string({
          invalid_type_error: 'timezone must be a string',
        })
        .min(1, 'timezone must not be empty')
        .refine((tz) => isValidTimezone(tz), {
          message: 'timezone must be a valid IANA timezone identifier',
        })
    )
    .optional(),

  fixedStartIntervalMinutes: z
    .preprocess(
      (val) => {
        if (val === undefined || val === '') return undefined;
        if (typeof val === 'string' && val.trim() !== '') return Number(val);
        return val;
      },
      z
        .number({
          invalid_type_error: 'fixedStartIntervalMinutes must be a number',
        })
        .int('fixedStartIntervalMinutes must be an integer')
        .refine(
          (val) => (ALLOWED_FIXED_START_INTERVALS as readonly number[]).includes(val),
          {
            message: 'fixedStartIntervalMinutes must be one of: 5, 10, 15, 20, 30, 60',
          }
        )
    )
    .optional(),

  cancellationCutoffHours: z
    .preprocess(
      (val) => {
        if (val === undefined || val === '') return undefined;
        if (typeof val === 'string' && val.trim() !== '') return Number(val);
        return val;
      },
      z
        .number({
          invalid_type_error: 'cancellationCutoffHours must be a number',
        })
        .int('cancellationCutoffHours must be an integer')
        .min(0, 'cancellationCutoffHours must be an integer greater than or equal to 0')
        .max(MAX_SETTING_HOURS, `cancellationCutoffHours must not exceed ${MAX_SETTING_HOURS} hours`)
    )
    .optional(),

  reminderLeadHours: z
    .preprocess(
      (val) => {
        if (val === undefined || val === '') return undefined;
        if (typeof val === 'string' && val.trim() !== '') return Number(val);
        return val;
      },
      z
        .number({
          invalid_type_error: 'reminderLeadHours must be a number',
        })
        .int('reminderLeadHours must be an integer')
        .min(1, 'reminderLeadHours must be greater than 0')
        .max(MAX_SETTING_HOURS, `reminderLeadHours must not exceed ${MAX_SETTING_HOURS} hours`)
    )
    .optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

