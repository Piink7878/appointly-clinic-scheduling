// ==============================================================================
// Appointly Client — Admin Doctor Schedules (/admin/schedules)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7 (F-007); AC-F007-01; SDS 4.2 & 4.3
// - Doctor dropdown (GET /api/v1/doctors — ADMIN sees active and inactive doctors)
// - Loads the chosen doctor's weekly schedule and holidays
//   (GET /api/v1/admin/doctors/:doctorId/schedule)
// - Edits the shifts (PUT .../schedule) and adds / removes holidays
//   (POST / DELETE .../exceptions) with the shared ScheduleEditor. Overrides ask
//   for an audit reason; a 422 overlap is shown as an error banner.
// - Switching doctor with unsaved edits asks for confirmation first.
// ==============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarClock, Users } from 'lucide-react';
import { AlertBanner, Modal, Skeleton, StatusBadge } from '../../shared/components';
import { listDoctors } from '../doctors/api';
import { Doctor } from '../doctors/types';
import {
  createDoctorException,
  deleteDoctorException,
  getDoctorSchedule,
  saveDoctorSchedule,
} from './api';
import { ScheduleEditor } from './ScheduleEditor';
import { MySchedule } from './types';

const doctorLabel = (d: Doctor): string =>
  `${d.fullName} — ${d.specialization}${d.profileStatus === 'INACTIVE' ? ' (inactive)' : ''}`;

export const AdminSchedulesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('doctorId') ?? '';

  // ---- doctor list -------------------------------------------------------
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [doctorsReload, setDoctorsReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setDoctorsLoading(true);
    setDoctorsError(null);

    listDoctors({ status: 'ALL', signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setDoctors(result);
        setDoctorsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setDoctorsError(err instanceof Error && err.message ? err.message : 'Unable to load doctors.');
        setDoctorsLoading(false);
      });

    return () => controller.abort();
  }, [doctorsReload]);

  // Only a doctor that exists in the list can be selected (ignores stale/forged ?doctorId=).
  const selected = doctors?.find((d) => d.doctorId === requestedId) ?? null;
  const selectedId = selected?.doctorId ?? '';

  // ---- selected doctor's schedule ---------------------------------------
  const [loaded, setLoaded] = useState<{ doctorId: string; data: MySchedule } | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleReload, setScheduleReload] = useState(0);

  useEffect(() => {
    if (!selectedId) {
      setLoaded(null);
      return undefined;
    }
    const controller = new AbortController();
    setScheduleLoading(true);
    setScheduleError(null);

    getDoctorSchedule(selectedId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setLoaded({ doctorId: selectedId, data });
        setScheduleLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoaded(null);
        setScheduleError(err instanceof Error && err.message ? err.message : "Unable to load the doctor's schedule.");
        setScheduleLoading(false);
      });

    return () => controller.abort();
  }, [selectedId, scheduleReload]);

  // ---- switching doctors with unsaved edits -----------------------------
  const [dirty, setDirty] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const applySelection = useCallback(
    (id: string) => {
      setDirty(false);
      setSearchParams(id ? { doctorId: id } : {});
    },
    [setSearchParams]
  );

  const requestSelection = (id: string) => {
    if (id === selectedId) return;
    if (dirty) setPendingId(id);
    else applySelection(id);
  };

  const editorReady = loaded !== null && loaded.doctorId === selectedId && !scheduleLoading && !scheduleError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Doctor Schedules</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose a doctor to view and override their weekly working hours and holidays. Every change you save
          here is recorded in the audit log. Times use the clinic timezone (Asia/Bangkok).
        </p>
      </div>

      {doctorsError && (
        <AlertBanner
          variant="error"
          message={doctorsError}
          action={
            <button
              type="button"
              onClick={() => setDoctorsReload((k) => k + 1)}
              className="flex-shrink-0 text-sm font-semibold text-red-800 underline hover:text-red-900"
            >
              Retry
            </button>
          }
        />
      )}

      {/* Doctor selector */}
      <div className="w-full sm:max-w-md">
        <label htmlFor="schedule-doctor" className="block text-sm font-medium text-slate-700 mb-1">
          Doctor
        </label>
        {doctorsLoading ? (
          <div aria-busy="true" aria-label="Loading doctors">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <select
            id="schedule-doctor"
            value={selectedId}
            onChange={(e) => requestSelection(e.target.value)}
            disabled={!doctors || doctors.length === 0}
            className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-60"
          >
            <option value="">Select a doctor…</option>
            {(doctors ?? []).map((d) => (
              <option key={d.doctorId} value={d.doctorId}>
                {doctorLabel(d)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* No doctors at all */}
      {!doctorsLoading && !doctorsError && doctors !== null && doctors.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <Users className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">No doctors yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add a doctor first, then manage their schedule here.{' '}
            <Link to="/admin/doctors" className="text-amber-700 underline hover:text-amber-900">
              Go to Doctor Management
            </Link>
          </p>
        </div>
      )}

      {/* Nothing selected yet */}
      {!doctorsLoading && doctors !== null && doctors.length > 0 && !selected && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <CalendarClock className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Select a doctor</h2>
          <p className="mt-1 text-sm text-slate-500">Pick a doctor above to see and edit their schedule.</p>
        </div>
      )}

      {selected && (
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Schedule for {selected.fullName}</h2>
          <StatusBadge status={selected.profileStatus} />
        </div>
      )}

      {scheduleError && (
        <AlertBanner
          variant="error"
          message={scheduleError}
          action={
            <button
              type="button"
              onClick={() => setScheduleReload((k) => k + 1)}
              className="flex-shrink-0 text-sm font-semibold text-red-800 underline hover:text-red-900"
            >
              Retry
            </button>
          }
        />
      )}

      {selected && scheduleLoading && (
        <div aria-busy="true" aria-label="Loading schedule" className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {selected && editorReady && loaded && (
        // `key` remounts the editor for another doctor or after a Retry.
        <ScheduleEditor
          key={`${selected.doctorId}-${scheduleReload}`}
          initial={loaded.data}
          requireReason
          subjectName={selected.fullName}
          saveShifts={(shifts, reason) => saveDoctorSchedule(selected.doctorId, shifts, reason ?? '')}
          createException={(input) => createDoctorException(selected.doctorId, input)}
          deleteException={(exceptionId) => deleteDoctorException(selected.doctorId, exceptionId)}
          onDirtyChange={setDirty}
        />
      )}

      {pendingId !== null && (
        <Modal
          title="Discard unsaved changes?"
          description="You have unsaved changes to this doctor's weekly hours. Switching doctors will discard them."
          onClose={() => setPendingId(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setPendingId(null)}
                className="inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  applySelection(pendingId);
                  setPendingId(null);
                }}
                className="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Discard & switch
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-700">This cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
};

export default AdminSchedulesPage;
