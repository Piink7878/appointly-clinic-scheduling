// ==============================================================================
// Appointly Client — Create / Edit Service Modal
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.4 (F-004); AC-F004-03; SDS Section 4.3
// - create: POST /api/v1/admin/services  { serviceName, description, durationMinutes }
// - edit:   PUT  /api/v1/admin/services/:serviceId  (same body)
// Inline validation first (duration 1..480); backend errors (409
// SERVICE_NAME_EXISTS, 400, 404) are surfaced without closing the dialog so no
// input is lost.
// ==============================================================================

import React, { useState } from 'react';
import { ApiClientError } from '../../shared/api';
import { AlertBanner, FormField, Modal, fieldInputClass } from '../../shared/components';
import { createService, updateService } from './api';
import { MedicalService } from './types';
import {
  SERVICE_LIMITS,
  ServiceFormErrors,
  ServiceFormValues,
  emptyServiceForm,
  isServiceFormDirty,
  serviceToFormValues,
  toServiceInput,
  validateServiceForm,
} from './validation';

export interface ServiceFormModalProps {
  mode: 'create' | 'edit';
  /** Required in edit mode. */
  service?: MedicalService;
  onClose: () => void;
  /** Called after a successful save with the text for the success banner. */
  onSaved: (message: string) => void;
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({ mode, service, onClose, onSaved }) => {
  const isEdit = mode === 'edit';
  const [values, setValues] = useState<ServiceFormValues>(() =>
    isEdit && service ? serviceToFormValues(service) : emptyServiceForm()
  );
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField =
    (field: keyof ServiceFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      // Clear a field's error as soon as the user edits it.
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };

  const dirty = !isEdit || !service || isServiceFormDirty(values, service);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const found = validateServiceForm(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setSubmitError(null);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const input = toServiceInput(values);
      if (isEdit && service) {
        const updated = await updateService(service.serviceId, input);
        onSaved(`Service “${updated?.serviceName ?? input.serviceName}” updated successfully.`);
      } else {
        const created = await createService(input);
        onSaved(`Service “${created?.serviceName ?? input.serviceName}” created successfully.`);
      }
    } catch (err) {
      setSaving(false);
      const message = err instanceof Error && err.message ? err.message : 'Unable to save the service.';
      if (err instanceof ApiClientError && err.code === 'SERVICE_NAME_EXISTS') {
        setErrors({ serviceName: message });
      } else {
        setSubmitError(message);
      }
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Service' : 'Add New Service'}
      description={
        isEdit
          ? 'Update the service name, description and standard duration.'
          : 'Adds a service patients can see once it is active.'
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
            form="service-form"
            disabled={saving || !dirty}
            className="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Service'}
          </button>
        </>
      }
    >
      <form id="service-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {submitError && <AlertBanner variant="error" message={submitError} />}

        <FormField id="service-name" label="Service name" required error={errors.serviceName}>
          {(describedBy) => (
            <input
              id="service-name"
              type="text"
              autoComplete="off"
              value={values.serviceName}
              onChange={setField('serviceName')}
              aria-invalid={Boolean(errors.serviceName)}
              aria-required="true"
              aria-describedby={describedBy}
              placeholder="e.g. General Consultation"
              className={fieldInputClass(Boolean(errors.serviceName))}
            />
          )}
        </FormField>

        <FormField id="service-description" label="Description" error={errors.description} hint="Optional.">
          {(describedBy) => (
            <textarea
              id="service-description"
              rows={3}
              value={values.description}
              onChange={setField('description')}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={describedBy}
              className={fieldInputClass(Boolean(errors.description))}
            />
          )}
        </FormField>

        <FormField
          id="service-duration"
          label="Duration (minutes)"
          required
          error={errors.durationMinutes}
          hint={`Whole minutes, ${SERVICE_LIMITS.durationMin}–${SERVICE_LIMITS.durationMax}.`}
        >
          {(describedBy) => (
            <input
              id="service-duration"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={values.durationMinutes}
              onChange={setField('durationMinutes')}
              aria-invalid={Boolean(errors.durationMinutes)}
              aria-required="true"
              aria-describedby={describedBy}
              placeholder="30"
              className={fieldInputClass(Boolean(errors.durationMinutes))}
            />
          )}
        </FormField>
      </form>
    </Modal>
  );
};

export default ServiceFormModal;
