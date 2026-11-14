// ==============================================================================
// Appointly Client — Admin Doctor-Service Assignment Modal ("Manage Services")
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.5 (F-005); AC-F005-01/02; SDS 4.3
// Lists every clinic service with its assignment state for one doctor.
//   - Assign:   POST   /api/v1/admin/doctors/:doctorId/services          { serviceId }
//   - Unassign: DELETE /api/v1/admin/doctors/:doctorId/services/:serviceId
// Each action takes effect immediately and reports the outcome in an alert
// banner. The current assignments are read fresh from GET /doctors/:doctorId
// so a stale list can never hide an existing assignment; a 409 / 404 caused by
// a concurrent change simply re-syncs the row.
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Link2, Link2Off } from 'lucide-react';
import { ApiClientError } from '../../shared/api';
import { AlertBanner, Modal, Skeleton, StatusBadge } from '../../shared/components';
import { listServices } from '../services/api';
import { MedicalService } from '../services/types';
import { formatDuration } from '../services/validation';
import { assignService, getDoctor, unassignService } from './api';
import { Doctor } from './types';

export interface DoctorServicesModalProps {
  doctor: Doctor;
  onClose: () => void;
}

interface Feedback {
  variant: 'success' | 'error';
  message: string;
}

export const DoctorServicesModal: React.FC<DoctorServicesModalProps> = ({ doctor, onClose }) => {
  const [services, setServices] = useState<MedicalService[] | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [pending, setPending] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    Promise.all([listServices({ signal: controller.signal }), getDoctor(doctor.doctorId, controller.signal)])
      .then(([allServices, fresh]) => {
        if (controller.signal.aborted) return;
        setServices(allServices);
        setAssigned(new Set((fresh.services ?? []).map((s) => s.serviceId)));
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error && err.message ? err.message : 'Unable to load services.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [doctor.doctorId, reloadKey]);

  const setBusy = (serviceId: string, busy: boolean) =>
    setPending((prev) => {
      const next = new Set(prev);
      if (busy) next.add(serviceId);
      else next.delete(serviceId);
      return next;
    });

  const setAssignedState = (serviceId: string, isAssigned: boolean) =>
    setAssigned((prev) => {
      const next = new Set(prev);
      if (isAssigned) next.add(serviceId);
      else next.delete(serviceId);
      return next;
    });

  const toggle = async (service: MedicalService) => {
    const { serviceId, serviceName } = service;
    if (pending.has(serviceId)) return;
    const wasAssigned = assigned.has(serviceId);

    setBusy(serviceId, true);
    setFeedback(null);
    try {
      if (wasAssigned) {
        await unassignService(doctor.doctorId, serviceId);
        setAssignedState(serviceId, false);
        setFeedback({ variant: 'success', message: `“${serviceName}” unassigned from ${doctor.fullName}.` });
      } else {
        await assignService(doctor.doctorId, serviceId);
        setAssignedState(serviceId, true);
        setFeedback({ variant: 'success', message: `“${serviceName}” assigned to ${doctor.fullName}.` });
      }
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Unable to update the assignment.';
      // The list was stale: keep the row in sync with what the server says.
      if (err instanceof ApiClientError && err.code === 'DUPLICATE_ASSIGNMENT') setAssignedState(serviceId, true);
      if (err instanceof ApiClientError && err.code === 'ASSIGNMENT_NOT_FOUND') setAssignedState(serviceId, false);
      setFeedback({ variant: 'error', message });
    } finally {
      setBusy(serviceId, false);
    }
  };

  const items = services ?? [];
  const assignedCount = items.filter((s) => assigned.has(s.serviceId)).length;

  return (
    <Modal
      title="Manage Services"
      description={`Choose which services ${doctor.fullName} offers. Changes apply immediately.`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
        >
          Done
        </button>
      }
    >
      <div className="space-y-4">
        {feedback && (
          <AlertBanner
            variant={feedback.variant}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        )}

        {loadError && (
          <AlertBanner
            variant="error"
            message={loadError}
            action={
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="flex-shrink-0 text-sm font-semibold text-red-800 underline hover:text-red-900"
              >
                Retry
              </button>
            }
          />
        )}

        {isLoading && (
          <div aria-busy="true" aria-label="Loading services" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-20 ml-auto" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && !loadError && items.length === 0 && (
          <div className="text-center py-8">
            <h3 className="text-base font-semibold text-slate-900">No services in the catalog</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create a service first, then assign it to doctors here.
            </p>
          </div>
        )}

        {!isLoading && !loadError && items.length > 0 && (
          <>
            <p className="text-sm text-slate-600" aria-live="polite">
              {assignedCount} of {items.length} services assigned
            </p>
            <ul aria-label="Clinic services" className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {items.map((s) => {
                const isAssigned = assigned.has(s.serviceId);
                const isBusy = pending.has(s.serviceId);
                return (
                  <li key={s.serviceId} className="p-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 break-words">{s.serviceName}</span>
                        {s.serviceStatus === 'INACTIVE' && <StatusBadge status={s.serviceStatus} />}
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDuration(s.durationMinutes)}
                        {' · '}
                        <span className={isAssigned ? 'text-emerald-700 font-medium' : undefined}>
                          {isAssigned ? 'Assigned' : 'Not assigned'}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(s)}
                      disabled={isBusy}
                      aria-label={`${isAssigned ? 'Unassign' : 'Assign'} ${s.serviceName}`}
                      className={`flex-shrink-0 inline-flex items-center px-2.5 py-1.5 rounded-lg border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 ${
                        isAssigned
                          ? 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:text-red-700'
                          : 'border-amber-600 text-white bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {isAssigned ? (
                        <Link2Off className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                      )}
                      {isBusy ? 'Saving…' : isAssigned ? 'Unassign' : 'Assign'}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-slate-500">
              Inactive services are hidden from patients even when assigned.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
};

export default DoctorServicesModal;
