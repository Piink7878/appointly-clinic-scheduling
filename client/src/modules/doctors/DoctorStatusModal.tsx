// ==============================================================================
// Appointly Client — Activate / Deactivate Confirmation Modal
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.3 (F-003); SDS Section 4.3
// PATCH /api/v1/admin/doctors/:doctorId/status  { profileStatus }
// Status changes are policy-sensitive (BR-003, FR-013) so they always require an
// explicit confirmation. A failed request keeps the dialog open with the reason.
// ==============================================================================

import React, { useState } from 'react';
import { AlertBanner, Modal } from '../../shared/components';
import { updateDoctorStatus } from './api';
import { Doctor, ProfileStatus } from './types';

export interface DoctorStatusModalProps {
  doctor: Doctor;
  onClose: () => void;
  /** Called after a successful change with the text for the success banner. */
  onChanged: (message: string) => void;
}

export const DoctorStatusModal: React.FC<DoctorStatusModalProps> = ({ doctor, onClose, onChanged }) => {
  const target: ProfileStatus = doctor.profileStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const deactivating = target === 'INACTIVE';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateDoctorStatus(doctor.doctorId, target);
      onChanged(`${doctor.fullName} is now ${deactivating ? 'inactive' : 'active'}.`);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error && err.message ? err.message : 'Unable to update the doctor status.');
    }
  };

  return (
    <Modal
      title={deactivating ? 'Deactivate doctor?' : 'Activate doctor?'}
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
              <strong>{doctor.fullName}</strong> will no longer be shown to patients or accept new bookings, and
              will not be able to sign in. Existing records are kept.
            </>
          ) : (
            <>
              <strong>{doctor.fullName}</strong> will be shown to patients again, can accept new bookings and can
              sign in.
            </>
          )}
        </p>
      </div>
    </Modal>
  );
};

export default DoctorStatusModal;
