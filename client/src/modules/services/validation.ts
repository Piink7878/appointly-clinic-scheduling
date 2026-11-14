// ==============================================================================
// Appointly Client — Service Form Validation & Formatting
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.4 (F-004), AC-F004-03.
// Mirrors server/src/modules/services/validation.ts (Zod) and the database CHECK:
//   serviceName      1..150 after trim
//   description      optional, <= 5000 after trim
//   durationMinutes  integer 1..480 (0, -15 and 481 are rejected; 1 and 480 pass)
// The server stays the authority; these checks give instant inline feedback.
// ==============================================================================

import { MedicalService, ServiceInput } from './types';

export const SERVICE_LIMITS = {
  name: 150,
  description: 5000,
  durationMin: 1,
  durationMax: 480,
} as const;

export interface ServiceFormValues {
  serviceName: string;
  description: string;
  /** Kept as the raw input text so "", "4." or "abc" can be reported precisely. */
  durationMinutes: string;
}

export type ServiceFormErrors = Partial<Record<keyof ServiceFormValues, string>>;

export const emptyServiceForm = (): ServiceFormValues => ({
  serviceName: '',
  description: '',
  durationMinutes: '',
});

export const serviceToFormValues = (service: MedicalService): ServiceFormValues => ({
  serviceName: service.serviceName,
  description: service.description ?? '',
  durationMinutes: String(service.durationMinutes),
});

const WHOLE_NUMBER = /^-?\d+$/;

/** Parses the duration text; returns NaN when it is not a whole number. */
export const parseDuration = (text: string): number => {
  const trimmed = text.trim();
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : NaN;
};

export function validateServiceForm(values: ServiceFormValues): ServiceFormErrors {
  const errors: ServiceFormErrors = {};

  const name = values.serviceName.trim();
  if (!name) errors.serviceName = 'Service name is required.';
  else if (name.length > SERVICE_LIMITS.name)
    errors.serviceName = `Service name must not exceed ${SERVICE_LIMITS.name} characters.`;

  if (values.description.trim().length > SERVICE_LIMITS.description)
    errors.description = `Description must not exceed ${SERVICE_LIMITS.description} characters.`;

  if (!values.durationMinutes.trim()) {
    errors.durationMinutes = 'Duration is required.';
  } else {
    const minutes = parseDuration(values.durationMinutes);
    if (Number.isNaN(minutes)) errors.durationMinutes = 'Duration must be a whole number of minutes.';
    else if (minutes < SERVICE_LIMITS.durationMin || minutes > SERVICE_LIMITS.durationMax)
      errors.durationMinutes = `Duration must be between ${SERVICE_LIMITS.durationMin} and ${SERVICE_LIMITS.durationMax} minutes.`;
  }

  return errors;
}

/** Request body for both POST and PUT. Call only after `validateServiceForm` returned no errors. */
export function toServiceInput(values: ServiceFormValues): ServiceInput {
  return {
    serviceName: values.serviceName.trim(),
    description: values.description.trim() || null,
    durationMinutes: parseDuration(values.durationMinutes),
  };
}

/** True when the edit form differs from the stored service (ignoring surrounding whitespace). */
export function isServiceFormDirty(values: ServiceFormValues, service: MedicalService): boolean {
  const original = serviceToFormValues(service);
  return (
    values.serviceName.trim() !== original.serviceName.trim() ||
    values.description.trim() !== original.description.trim() ||
    parseDuration(values.durationMinutes) !== service.durationMinutes
  );
}

/** "30 mins" / "1 min" — the duration badge text from the contract (§1.4). */
export const formatDuration = (minutes: number): string => `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
