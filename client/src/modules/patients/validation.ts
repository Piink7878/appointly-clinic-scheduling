// ==============================================================================
// Appointly Client — Patient Profile Form Validation
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.2 / AC-F002-03
// - fullName: required, non-blank, <= 150 chars (VARCHAR(150) NOT NULL)
// - phoneNumber: Thai mobile 0[689]\d{8} or E.164
// - dateOfBirth: optional, must be strictly in the past
// Client-side checks give instant inline feedback; the backend remains the
// authoritative validator.
// ==============================================================================

import { getMaxDobDate } from '../../shared/utils';

export interface ProfileFormValues {
  fullName: string;
  phoneNumber: string;
  /** "YYYY-MM-DD" or "" when empty. */
  dateOfBirth: string;
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

/** Trims and removes spaces/hyphens so "081-234-5678" is stored as "0812345678". */
export function normalizePhone(value: string): string {
  return value.trim().replace(/[\s-]/g, '');
}

const THAI_MOBILE = /^0[689]\d{8}$/;
const E164 = /^\+[1-9]\d{6,14}$/;

export function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  return THAI_MOBILE.test(normalized) || E164.test(normalized);
}

function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function validateProfileForm(
  values: ProfileFormValues,
  now: Date = new Date()
): ProfileFormErrors {
  const errors: ProfileFormErrors = {};

  const name = values.fullName.trim();
  if (!name) {
    errors.fullName = 'Full name is required.';
  } else if (name.length > 150) {
    errors.fullName = 'Full name must not exceed 150 characters.';
  }

  if (!values.phoneNumber.trim()) {
    errors.phoneNumber = 'Phone number is required.';
  } else if (!isValidPhone(values.phoneNumber)) {
    errors.phoneNumber = 'Enter a valid phone number, e.g. 0812345678 or +66812345678.';
  }

  if (values.dateOfBirth) {
    if (!isRealCalendarDate(values.dateOfBirth)) {
      errors.dateOfBirth = 'Enter a valid date of birth.';
    } else if (values.dateOfBirth > getMaxDobDate(now)) {
      errors.dateOfBirth = 'Date of birth must be in the past.';
    }
  }

  return errors;
}
