// ==============================================================================
// Appointly Client — Create / Edit Doctor Modal
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.3 (F-003); AC-F003-03; SDS Section 4.3
// - create: POST /api/v1/admin/doctors  { email, password, fullName,
//           specialization, professionalLicenseNumber? }
// - edit:   PUT  /api/v1/admin/doctors/:doctorId  { fullName, specialization,
//           professionalLicenseNumber }   (email / password are not editable)
// Inline validation first; backend errors (409 EMAIL_ALREADY_EXISTS, 400, 404)
// are surfaced in the dialog without closing it so no input is lost.
// ==============================================================================

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ApiClientError } from '../../shared/api';
import { AlertBanner, Modal } from '../../shared/components';
import { createDoctor, updateDoctor } from './api';
import { Doctor } from './types';
import {
  DOCTOR_LIMITS,
  DoctorFormErrors,
  DoctorFormMode,
  DoctorFormValues,
  doctorToFormValues,
  emptyDoctorForm,
  isDoctorFormDirty,
  toCreatePayload,
  toUpdatePayload,
  validateDoctorForm,
} from './validation';

export interface DoctorFormModalProps {
  mode: DoctorFormMode;
  /** Required in edit mode. */
  doctor?: Doctor;
  onClose: () => void;
  /** Called after a successful save with the text for the success banner. */
  onSaved: (message: string) => void;
}

const inputClass = (invalid: boolean, readOnly = false) =>
  `block w-full px-3 py-2.5 border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
    invalid
      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
      : 'border-slate-300 focus:ring-amber-500 focus:border-amber-500'
  } ${readOnly ? 'bg-slate-50 text-slate-500' : 'bg-white'}`;

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (describedBy: string | undefined) => React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ id, label, error, hint, required, children }) => {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <div className="flex items-baseline gap-1 mb-1">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
        {required && (
          <span className="text-red-500 text-sm" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {children(describedBy)}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export const DoctorFormModal: React.FC<DoctorFormModalProps> = ({ mode, doctor, onClose, onSaved }) => {
  const isEdit = mode === 'edit';
  const [values, setValues] = useState<DoctorFormValues>(() =>
    isEdit && doctor ? doctorToFormValues(doctor) : emptyDoctorForm()
  );
  const [errors, setErrors] = useState<DoctorFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const setField = (field: keyof DoctorFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear a field's error as soon as the user edits it.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const dirty = !isEdit || !doctor || isDoctorFormDirty(values, doctor);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const found = validateDoctorForm(values, mode);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setSubmitError(null);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      if (isEdit && doctor) {
        const updated = await updateDoctor(doctor.doctorId, toUpdatePayload(values));
        onSaved(`Doctor profile for ${updated?.fullName ?? values.fullName.trim()} updated successfully.`);
      } else {
        const created = await createDoctor(toCreatePayload(values));
        onSaved(`Doctor ${created?.fullName ?? values.fullName.trim()} created successfully.`);
      }
    } catch (err) {
      setSaving(false);
      const message = err instanceof Error && err.message ? err.message : 'Unable to save the doctor.';
      if (err instanceof ApiClientError && err.code === 'EMAIL_ALREADY_EXISTS') {
        setErrors({ email: message });
      } else {
        setSubmitError(message);
      }
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Doctor' : 'Add New Doctor'}
      description={
        isEdit
          ? 'Update the doctor’s name, specialization and license number.'
          : 'Creates the doctor’s sign-in account and clinical profile together.'
      }
      onClose={onClose}
      closeDisabled={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="doctor-form"
            disabled={saving || !dirty}
            className="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Doctor'}
          </button>
        </>
      }
    >
      <form id="doctor-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {submitError && <AlertBanner variant="error" message={submitError} />}

        {isEdit ? (
          <Field id="doctor-email" label="Email" hint="The sign-in email cannot be changed here.">
            {(describedBy) => (
              <input
                id="doctor-email"
                type="email"
                value={values.email}
                readOnly
                aria-describedby={describedBy}
                className={inputClass(false, true)}
              />
            )}
          </Field>
        ) : (
          <Field id="doctor-email" label="Email" required error={errors.email}>
            {(describedBy) => (
              <input
                id="doctor-email"
                type="email"
                autoComplete="off"
                value={values.email}
                onChange={setField('email')}
                maxLength={DOCTOR_LIMITS.email}
                aria-invalid={Boolean(errors.email)}
                aria-required="true"
                aria-describedby={describedBy}
                placeholder="doctor@appointly.local"
                className={inputClass(Boolean(errors.email))}
              />
            )}
          </Field>
        )}

        {!isEdit && (
          <Field
            id="doctor-password"
            label="Temporary password"
            required
            error={errors.password}
            hint={`${DOCTOR_LIMITS.passwordMin}–${DOCTOR_LIMITS.passwordMax} characters. Share it with the doctor securely.`}
          >
            {(describedBy) => (
              <div className="relative">
                <input
                  id="doctor-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={values.password}
                  onChange={setField('password')}
                  maxLength={DOCTOR_LIMITS.passwordMax + 20}
                  aria-invalid={Boolean(errors.password)}
                  aria-required="true"
                  aria-describedby={describedBy}
                  className={`${inputClass(Boolean(errors.password))} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
          </Field>
        )}

        <Field id="doctor-fullName" label="Full name" required error={errors.fullName}>
          {(describedBy) => (
            <input
              id="doctor-fullName"
              type="text"
              autoComplete="off"
              value={values.fullName}
              onChange={setField('fullName')}
              aria-invalid={Boolean(errors.fullName)}
              aria-required="true"
              aria-describedby={describedBy}
              className={inputClass(Boolean(errors.fullName))}
            />
          )}
        </Field>

        <Field id="doctor-specialization" label="Specialization" required error={errors.specialization}>
          {(describedBy) => (
            <input
              id="doctor-specialization"
              type="text"
              autoComplete="off"
              value={values.specialization}
              onChange={setField('specialization')}
              aria-invalid={Boolean(errors.specialization)}
              aria-required="true"
              aria-describedby={describedBy}
              placeholder="e.g. Cardiology"
              className={inputClass(Boolean(errors.specialization))}
            />
          )}
        </Field>

        <Field
          id="doctor-license"
          label="Professional license number"
          error={errors.professionalLicenseNumber}
          hint="Optional."
        >
          {(describedBy) => (
            <input
              id="doctor-license"
              type="text"
              autoComplete="off"
              value={values.professionalLicenseNumber}
              onChange={setField('professionalLicenseNumber')}
              aria-invalid={Boolean(errors.professionalLicenseNumber)}
              aria-describedby={describedBy}
              className={inputClass(Boolean(errors.professionalLicenseNumber))}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
};

export default DoctorFormModal;
