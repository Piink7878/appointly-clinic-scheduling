// ==============================================================================
// Appointly Client — Doctor Schedule Manager (/doctor/schedule)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6 (F-006); AC-F006-01/02/03;
//            SDS Sections 4.2 & 4.3
// - Weekly recurring schedule: 7-day editor with split shifts; "Save Schedule"
//   PUTs the whole week to /api/v1/doctors/me/schedule. Overlaps are caught
//   inline; a server 422 INVALID_SCHEDULE_WINDOW is shown as an error banner.
// - Exceptions manager: holidays / breaks / custom hours (see ExceptionsManager).
// - Skeleton while loading, error banner with retry.
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { AlertBanner, Skeleton } from '../../shared/components';
import { createException, deleteException, getMySchedule, saveMySchedule } from './api';
import { ScheduleEditor } from './ScheduleEditor';
import { type MySchedule } from './types';

export const DoctorScheduleManagerPage: React.FC = () => {
  const [schedule, setSchedule] = useState<MySchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    getMySchedule(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setSchedule(result);
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error && err.message ? err.message : 'Unable to load your schedule.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set your recurring weekly working hours and block holidays or time off. Times use the clinic timezone
          (Asia/Bangkok).
        </p>
      </div>

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
        <div aria-busy="true" aria-label="Loading schedule" className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !loadError && schedule && (
        // `key` remounts the editor with fresh data after a Retry.
        <ScheduleEditor
          key={reloadKey}
          initial={schedule}
          saveShifts={(shifts) => saveMySchedule(shifts)}
          createException={createException}
          deleteException={deleteException}
        />
      )}
    </div>
  );
};

export default DoctorScheduleManagerPage;
