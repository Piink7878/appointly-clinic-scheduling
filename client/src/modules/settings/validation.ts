// ==============================================================================
// Appointly Client — Clinic Settings Form Validation
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7 (F-007), AC-F007-02/03.
// Mirrors server/src/modules/settings/validation.ts (Zod) and the database CHECKs:
//   clinicName                 1..150 characters
//   timezone                   a valid IANA identifier (Intl), default Asia/Bangkok
//   fixedStartIntervalMinutes  one of 5, 10, 15, 20, 30, 60 (0 and 7 are rejected)
//   cancellationCutoffHours    whole number >= 0 (0 accepted, -1 rejected)
// The server stays the authority; these checks give instant inline feedback.
// ==============================================================================

import { ClinicSettings, UpdateSettingsInput } from './types';

export const DEFAULT_TIMEZONE = 'Asia/Bangkok';
export const FIXED_START_INTERVALS = [5, 10, 15, 20, 30, 60] as const;
export const CLINIC_NAME_MAX = 150;
/** One year. Not in the contract; the server enforces the same cap (MAX_SETTING_HOURS) so a huge value is a 400, not a database overflow. */
export const CUTOFF_HOURS_MAX = 8760;

export interface SettingsFormValues {
  clinicName: string;
  timezone: string;
  fixedStartIntervalMinutes: string;
  cancellationCutoffHours: string;
}

export type SettingsFormErrors = Partial<Record<keyof SettingsFormValues, string>>;

export const settingsToForm = (s: ClinicSettings): SettingsFormValues => ({
  clinicName: s.clinicName,
  timezone: s.timezone || DEFAULT_TIMEZONE,
  fixedStartIntervalMinutes: String(s.fixedStartIntervalMinutes),
  cancellationCutoffHours: String(s.cancellationCutoffHours),
});

/** Same test the server uses (`Intl.DateTimeFormat` accepts only real IANA identifiers). */
export const isValidTimezone = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/** Suggestions for the timezone field, Asia/Bangkok first. */
export function getTimezoneOptions(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  let zones: string[] = [];
  try {
    zones = intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  return [DEFAULT_TIMEZONE, ...zones.filter((z) => z !== DEFAULT_TIMEZONE), ...(zones.includes('UTC') ? [] : ['UTC'])];
}

const WHOLE_NUMBER = /^\d+$/;

export function validateSettingsForm(values: SettingsFormValues): SettingsFormErrors {
  const errors: SettingsFormErrors = {};

  const name = values.clinicName.trim();
  if (!name) errors.clinicName = 'Clinic name is required.';
  else if (name.length > CLINIC_NAME_MAX) errors.clinicName = `Clinic name must not exceed ${CLINIC_NAME_MAX} characters.`;

  const timezone = values.timezone.trim();
  if (!timezone) errors.timezone = 'Timezone is required.';
  else if (!isValidTimezone(timezone)) errors.timezone = 'Enter a valid IANA timezone, for example Asia/Bangkok.';

  const interval = Number(values.fixedStartIntervalMinutes);
  if (!(FIXED_START_INTERVALS as readonly number[]).includes(interval))
    errors.fixedStartIntervalMinutes = `Choose one of: ${FIXED_START_INTERVALS.join(', ')} minutes.`;

  const cutoffText = values.cancellationCutoffHours.trim();
  if (!cutoffText) errors.cancellationCutoffHours = 'Cancellation cutoff is required.';
  else if (!WHOLE_NUMBER.test(cutoffText))
    errors.cancellationCutoffHours = 'Enter a whole number of hours, 0 or more.';
  else if (Number(cutoffText) > CUTOFF_HOURS_MAX)
    errors.cancellationCutoffHours = `Cutoff must not exceed ${CUTOFF_HOURS_MAX} hours.`;

  return errors;
}

/** Call only after `validateSettingsForm` returned no errors. */
export const toSettingsInput = (values: SettingsFormValues): UpdateSettingsInput => ({
  clinicName: values.clinicName.trim(),
  timezone: values.timezone.trim(),
  fixedStartIntervalMinutes: Number(values.fixedStartIntervalMinutes),
  cancellationCutoffHours: Number(values.cancellationCutoffHours.trim()),
});

export const isSettingsDirty = (values: SettingsFormValues, saved: ClinicSettings): boolean => {
  const original = settingsToForm(saved);
  return (
    values.clinicName.trim() !== original.clinicName.trim() ||
    values.timezone.trim() !== original.timezone.trim() ||
    values.fixedStartIntervalMinutes !== original.fixedStartIntervalMinutes ||
    values.cancellationCutoffHours.trim() !== original.cancellationCutoffHours
  );
};
