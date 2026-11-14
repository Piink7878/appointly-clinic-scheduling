// ==============================================================================
// Appointly Client — Doctor Form Validation
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.3 (F-003), AC-F003-03.
// Mirrors server/src/modules/doctors/validation.ts (Zod):
//   email           valid format, <= 255
//   password        8..100 characters (create only, not trimmed)
//   fullName        1..150 after trim
//   specialization  1..150 after trim (151 is rejected, 150 accepted)
//   licenseNumber   optional, <= 100 after trim
// The server stays the authority; these checks give instant inline feedback.
// ==============================================================================

import { CreateDoctorInput, Doctor, UpdateDoctorInput } from './types';

export const DOCTOR_LIMITS = {
  email: 255,
  passwordMin: 8,
  passwordMax: 100,
  fullName: 150,
  specialization: 150,
  licenseNumber: 100,
} as const;

export interface DoctorFormValues {
  email: string;
  password: string;
  fullName: string;
  specialization: string;
  professionalLicenseNumber: string;
}

export type DoctorFormErrors = Partial<Record<keyof DoctorFormValues, string>>;

export type DoctorFormMode = 'create' | 'edit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emptyDoctorForm = (): DoctorFormValues => ({
  email: '',
  password: '',
  fullName: '',
  specialization: '',
  professionalLicenseNumber: '',
});

export const doctorToFormValues = (doctor: Doctor): DoctorFormValues => ({
  email: doctor.email ?? '',
  password: '',
  fullName: doctor.fullName,
  specialization: doctor.specialization,
  professionalLicenseNumber: doctor.professionalLicenseNumber ?? '',
});

export function validateDoctorForm(values: DoctorFormValues, mode: DoctorFormMode): DoctorFormErrors {
  const errors: DoctorFormErrors = {};

  if (mode === 'create') {
    const email = values.email.trim();
    if (!email) errors.email = 'Email is required.';
    else if (email.length > DOCTOR_LIMITS.email)
      errors.email = `Email must not exceed ${DOCTOR_LIMITS.email} characters.`;
    else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';

    if (!values.password) errors.password = 'Password is required.';
    else if (values.password.length < DOCTOR_LIMITS.passwordMin)
      errors.password = `Password must be at least ${DOCTOR_LIMITS.passwordMin} characters long.`;
    else if (values.password.length > DOCTOR_LIMITS.passwordMax)
      errors.password = `Password must not exceed ${DOCTOR_LIMITS.passwordMax} characters.`;
  }

  const fullName = values.fullName.trim();
  if (!fullName) errors.fullName = 'Full name is required.';
  else if (fullName.length > DOCTOR_LIMITS.fullName)
    errors.fullName = `Full name must not exceed ${DOCTOR_LIMITS.fullName} characters.`;

  const specialization = values.specialization.trim();
  if (!specialization) errors.specialization = 'Specialization is required.';
  else if (specialization.length > DOCTOR_LIMITS.specialization)
    errors.specialization = `Specialization must not exceed ${DOCTOR_LIMITS.specialization} characters.`;

  if (values.professionalLicenseNumber.trim().length > DOCTOR_LIMITS.licenseNumber)
    errors.professionalLicenseNumber = `License number must not exceed ${DOCTOR_LIMITS.licenseNumber} characters.`;

  return errors;
}

/** POST body. An empty licence number is omitted (it is optional). */
export function toCreatePayload(values: DoctorFormValues): CreateDoctorInput {
  const license = values.professionalLicenseNumber.trim();
  return {
    email: values.email.trim().toLowerCase(),
    password: values.password,
    fullName: values.fullName.trim(),
    specialization: values.specialization.trim(),
    ...(license ? { professionalLicenseNumber: license } : {}),
  };
}

/** PUT body. An emptied licence number is sent as `null` so it is actually cleared. */
export function toUpdatePayload(values: DoctorFormValues): UpdateDoctorInput {
  return {
    fullName: values.fullName.trim(),
    specialization: values.specialization.trim(),
    professionalLicenseNumber: values.professionalLicenseNumber.trim() || null,
  };
}

/** True when the edit form differs from the stored doctor (ignoring surrounding whitespace). */
export function isDoctorFormDirty(values: DoctorFormValues, doctor: Doctor): boolean {
  const original = doctorToFormValues(doctor);
  return (
    values.fullName.trim() !== original.fullName.trim() ||
    values.specialization.trim() !== original.specialization.trim() ||
    values.professionalLicenseNumber.trim() !== original.professionalLicenseNumber.trim()
  );
}
