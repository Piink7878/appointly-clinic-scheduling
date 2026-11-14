// ==============================================================================
// Appointly Server — Patient Validation Schemas
// ==============================================================================
// Reference: System-Level SDS Section 3.2B, 5.2 & Sprint 1 Contracts (F-002)
// Enforces mandatory demographic/contact validation and strictly excludes EMR fields.
// ==============================================================================

import { z } from 'zod';
import { toBangkokDateString } from '../../shared/utils/timezone';

/**
 * Validates standard phone number formats:
 * - Standard Thai mobile format: 0[689]\d{8} (10 digits starting with 06, 08, 09)
 * - Thai mobile format with standard hyphens/spaces: 081-234-5678, 081 234 5678
 * - Standard E.164 international format: +[country_code][number] (e.g., +66812345678, +14155552671)
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();

  // 1. Standard Thai mobile format: 0[689]\d{8} (10 digits total)
  if (/^0[689]\d{8}$/.test(trimmed)) {
    return true;
  }

  // 2. Thai mobile format with hyphens or spaces (e.g., 081-234-5678, 081 234 5678)
  if (
    /^0[689]\d[-\s]?\d{3}[-\s]?\d{4}$/.test(trimmed) ||
    /^0[689]\d{2}[-\s]?\d{3}[-\s]?\d{3}$/.test(trimmed)
  ) {
    return true;
  }

  // 3. Standard E.164 format: +[1-9]\d{6,14} (7 to 15 digits total)
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) {
    return true;
  }

  // 4. E.164 format with optional spaces or hyphens (e.g., +66 81 234 5678, +1-415-555-2671)
  if (/^\+[1-9][\d\s-]{6,18}$/.test(trimmed)) {
    const stripped = trimmed.replace(/[\s-]/g, '');
    if (/^\+[1-9]\d{6,14}$/.test(stripped)) {
      return true;
    }
  }

  return false;
}

/**
 * Parses date of birth input into a Date instance.
 */
export function parseDob(val: string | Date): Date {
  if (val instanceof Date) return val;
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`);
  }
  return new Date(trimmed);
}

/**
 * Validates that dateOfBirth is a valid date strictly in the past (< current_date).
 */
export function isValidPastDate(val: string | Date): boolean {
  if (typeof val === 'string' && val.trim() === '') {
    return false;
  }
  const date = parseDob(val);
  if (isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  // Must be in the past in milliseconds
  if (date.getTime() >= now.getTime()) {
    return false;
  }

  // Check against clinic local calendar date (Asia/Bangkok) (< current_date)
  const todayBangkok = toBangkokDateString(now);
  const dateBangkok = toBangkokDateString(date);
  if (dateBangkok >= todayBangkok) {
    return false;
  }

  // Check against UTC calendar date (< current_date)
  const todayUtc = now.toISOString().split('T')[0];
  const dateUtc = date.toISOString().split('T')[0];
  if (dateUtc >= todayUtc) {
    return false;
  }

  return true;
}

/**
 * Validation schema for updating patient profile: PUT /api/v1/patients/me
 * Accepts { fullName, phoneNumber, dateOfBirth? }
 */
export const updatePatientSchema = z.object({
  fullName: z
    .string({ required_error: 'fullName is required.' })
    .trim()
    .min(1, 'fullName must not be empty or whitespace-only.')
    .max(150, 'fullName must not exceed 150 characters.')
    .refine((val) => val.trim().length > 0, 'fullName must not be whitespace-only.'),
  phoneNumber: z
    .string({ required_error: 'phoneNumber is required.' })
    .trim()
    .refine(
      isValidPhoneNumber,
      'phoneNumber must match standard phone number formats (e.g., E.164 or Thai mobile format 0[689]\\d{8}).'
    ),
  dateOfBirth: z
    .union([z.string(), z.date(), z.null()])
    .optional()
    .refine((val) => {
      if (val === undefined || val === null) return true;
      return isValidPastDate(val);
    }, 'dateOfBirth must be a past date strictly before the current date (< current_date).')
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null) return null;
      return parseDob(val);
    }),
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

/**
 * Validation schema for querying patient directory: GET /api/v1/admin/patients
 * Supports ?search=&page=1&limit=20
 */
export const getPatientsQuerySchema = z.object({
  search: z.string().optional(),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return 1;
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return 20;
      const parsed = typeof val === 'number' ? val : parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? 20 : Math.min(100, parsed);
    }),
});

export type GetPatientsQueryInput = z.infer<typeof getPatientsQuerySchema>;

