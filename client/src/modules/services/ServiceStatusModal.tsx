// ==============================================================================
// Appointly Client — Activate / Deactivate Service Confirmation Modal
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.4 (F-004); SDS Section 4.3
// PATCH /api/v1/admin/services/:serviceId/status  { serviceStatus }
// Hiding a service from patients is policy-sensitive (BR-004, FR-018), so the
// toggle always needs an explicit confirmation. A failed request keeps the
// dialog open with the reason.
// ==============================================================================

import React, { useState } from 'react';
import { AlertBanner, Modal } from '../../shared/components';
import { updateServiceStatus } from './api';
import { MedicalService, ServiceStatus } from './types';

export interface ServiceStatusModalProps {
  service: MedicalService;
  onClose: () => void;
  /** Called after a successful change with the text for the success banner. */
  onChanged: (message: string) => void;
}

export const ServiceStatusModal: React.FC<ServiceStatusModalProps> = ({ service, onClose, onChanged }) => {
  const target: ServiceStatus = service.serviceStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const deactivating = target === 'INACTIVE';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateServiceStatus(service.serviceId, target);
      onChanged(`“${service.serviceName}” is now ${deactivating ? 'inactive' : 'active'}.`);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error && err.message ? err.message : 'Unable to update the service status.');
    }
  };

  return (
    <Modal
      title={deactivating ? 'Deactivate service?' : 'Activate service?'}
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
            type="button"
            onClick={confirm}
            disabled={saving}
            className={`inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              deactivating
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
            }`}
          >
            {saving ? 'Saving…' : deactivating ? 'Deactivate' : 'Activate'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <AlertBanner variant="error" message={error} />}
        <p className="text-sm text-slate-700">
          {deactivating ? (
            <>
              <strong>{service.serviceName}</strong> will be hidden from patients and can no longer be chosen for
              new bookings. Existing records are kept.
            </>
          ) : (
            <>
              <strong>{service.serviceName}</strong> will be shown to patients again and can be chosen for new
              bookings.
            </>
          )}
        </p>
      </div>
    </Modal>
  );
};

export default ServiceStatusModal;
