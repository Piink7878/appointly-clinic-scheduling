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

import React, { useCallback, useEffect, useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { ApiClientError } from '../../shared/api';
import { AlertBanner, Skeleton } from '../../shared/components';
import { getMySchedule, saveMySchedule } from './api';
import { ExceptionsManager } from './ExceptionsManager';
import { ScheduleException } from './types';
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor';
import {
  WeekDraft,
  draftToPayload,
  emptyWeek,
  isWeekDirty,
  shiftsToDraft,
  sortExceptions,
  validateWeek,
} from './validation';

interface Feedback {
  variant: 'success' | 'error';
  message: string;
}

export const DoctorScheduleManagerPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [baseline, setBaseline] = useState<WeekDraft>(emptyWeek);
  const [draft, setDraft] = useState<WeekDraft>(emptyWeek);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Stable identity so the banner's auto-dismiss timer is not restarted by every re-render.
  const dismissFeedback = useCallback(() => setFeedback(null), []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    getMySchedule(controller.signal)
      .then((schedule) => {
        if (controller.signal.aborted) return;
        const week = shiftsToDraft(schedule.weeklySchedules);
        setBaseline(week);
        setDraft(week);
        setExceptions(sortExceptions(schedule.exceptions));
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error && err.message ? err.message : 'Unable to load your schedule.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const errors = validateWeek(draft);
  const visibleErrors = showErrors ? errors : { slots: {}, count: 0 };
  const dirty = isWeekDirty(draft, baseline);

  const handleChange = (next: WeekDraft) => {
    setDraft(next);
    setFeedback(null);
  };

  const handleSave = async () => {
    if (saving) return;

    if (errors.count > 0) {
      setShowErrors(true);
      setFeedback({
        variant: 'error',
        message: `Fix ${errors.count} time slot${errors.count === 1 ? '' : 's'} before saving: shifts need an end after the start and must not overlap.`,
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const saved = await saveMySchedule(draftToPayload(draft));
      // Re-base on what the server stored (falls back to what we sent).
      const next = saved.length > 0 || draftToPayload(draft).length === 0 ? shiftsToDraft(saved) : draft;
      setBaseline(next);
      setDraft(next);
      setShowErrors(false);
      setFeedback({ variant: 'success', message: 'Weekly schedule saved successfully.' });
    } catch (err) {
      setFeedback({
        variant: 'error',
        message:
          err instanceof ApiClientError && err.code === 'INVALID_SCHEDULE_WINDOW'
            ? `Schedule not saved — time windows overlap or are invalid. ${err.message}`
            : err instanceof Error && err.message
              ? err.message
              : 'Unable to save the schedule.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(baseline);
    setShowErrors(false);
    setFeedback(null);
  };

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

      {!isLoading && !loadError && (
        <>
          <section aria-labelledby="weekly-heading" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 id="weekly-heading" className="text-lg font-semibold text-slate-900">
                  Weekly Working Hours
                </h2>
                <p className="text-sm text-slate-600">
                  Add several time slots to a day for split shifts, for example 09:00–12:00 and 13:00–17:00.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!dirty || saving}
                  className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <Undo2 className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Discard changes
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Save className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  {saving ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </div>

            {feedback && (
              <AlertBanner
                variant={feedback.variant}
                message={feedback.message}
                onDismiss={dismissFeedback}
                autoDismissMs={feedback.variant === 'success' ? 5000 : undefined}
              />
            )}

            <WeeklyScheduleEditor
              week={draft}
              errors={visibleErrors}
              onChange={handleChange}
              disabled={saving}
            />
          </section>

          <ExceptionsManager
            exceptions={exceptions}
            onCreated={(created) => setExceptions((prev) => sortExceptions([...prev, created]))}
            onDeleted={(id) => setExceptions((prev) => prev.filter((ex) => ex.exceptionId !== id))}
          />
        </>
      )}
    </div>
  );
};

export default DoctorScheduleManagerPage;
