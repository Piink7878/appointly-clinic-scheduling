// ==============================================================================
// Appointly Client — Schedule Editor (weekly hours + holidays / time off)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6 (F-006) and 1.7 (F-007); SDS 4.2 & 4.3
// One editor used by both portals:
//   - Doctor (/doctor/schedule): edits their own schedule (PUT /doctors/me/schedule)
//   - Admin  (/admin/schedules): edits any doctor's schedule
//     (PUT /admin/doctors/:doctorId/schedule). An administrator override must carry
//     an audit reason (SDS 6.1), collected in a confirmation modal before saving.
// The parent supplies the data and the API calls; this component owns the draft,
// validation, banners and the Save flow. Overlaps are caught inline; a server
// 422 INVALID_SCHEDULE_WINDOW is shown as an error banner and the edits are kept.
// ==============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { ApiClientError } from '../../shared/api';
import { AlertBanner, FormField, Modal } from '../../shared/components';
import { ExceptionsManager } from './ExceptionsManager';
import { CreateExceptionInput, MySchedule, ScheduleException, ShiftInput, WeeklyShift } from './types';
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor';
import {
  REASON_MAX_LENGTH,
  WeekDraft,
  draftToPayload,
  isWeekDirty,
  shiftsToDraft,
  sortExceptions,
  validateWeek,
} from './validation';

export interface ScheduleEditorProps {
  initial: MySchedule;
  /** Persists the whole week. `reason` is only supplied when `requireReason` is set. */
  saveShifts: (shifts: ShiftInput[], reason?: string) => Promise<WeeklyShift[]>;
  createException: (input: CreateExceptionInput) => Promise<ScheduleException>;
  deleteException: (exceptionId: string) => Promise<void>;
  /** Administrator override: ask for an audit reason before saving and when adding a holiday. */
  requireReason?: boolean;
  /** Name shown in the override confirmation (admin mode). */
  subjectName?: string;
  /** Lets a parent warn before unsaved edits are thrown away. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface Feedback {
  variant: 'success' | 'error';
  message: string;
}

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  initial,
  saveShifts,
  createException,
  deleteException,
  requireReason = false,
  subjectName,
  onDirtyChange,
}) => {
  const [baseline, setBaseline] = useState<WeekDraft>(() => shiftsToDraft(initial.weeklySchedules));
  const [draft, setDraft] = useState<WeekDraft>(baseline);
  const [exceptions, setExceptions] = useState<ScheduleException[]>(() => sortExceptions(initial.exceptions));

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Reason-for-override confirmation (admin mode)
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  // Stable identity so the banner's auto-dismiss timer is not restarted by every re-render.
  const dismissFeedback = useCallback(() => setFeedback(null), []);

  const errors = validateWeek(draft);
  const visibleErrors = showErrors ? errors : { slots: {}, count: 0 };
  const dirty = isWeekDirty(draft, baseline);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleChange = (next: WeekDraft) => {
    setDraft(next);
    setFeedback(null);
  };

  const persist = async (overrideReason?: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = draftToPayload(draft);
      const saved = await saveShifts(payload, overrideReason);
      // Re-base on what the server stored (falls back to what we sent).
      const next = saved.length > 0 || payload.length === 0 ? shiftsToDraft(saved) : draft;
      setBaseline(next);
      setDraft(next);
      setShowErrors(false);
      setConfirming(false);
      setReason('');
      setFeedback({ variant: 'success', message: 'Weekly schedule saved successfully.' });
    } catch (err) {
      setConfirming(false);
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

  const handleSave = () => {
    if (saving) return;

    if (errors.count > 0) {
      setShowErrors(true);
      setFeedback({
        variant: 'error',
        message: `Fix ${errors.count} time slot${errors.count === 1 ? '' : 's'} before saving: shifts need an end after the start and must not overlap.`,
      });
      return;
    }

    if (requireReason) {
      setReasonError(null);
      setConfirming(true);
      return;
    }
    void persist();
  };

  const confirmOverride = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('A reason is required for this change.');
      return;
    }
    if (trimmed.length > REASON_MAX_LENGTH) {
      setReasonError(`Reason must not exceed ${REASON_MAX_LENGTH} characters.`);
      return;
    }
    void persist(trimmed);
  };

  const handleReset = () => {
    setDraft(baseline);
    setShowErrors(false);
    setFeedback(null);
  };

  return (
    <div className="space-y-8">
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
              {saving && !confirming ? 'Saving…' : 'Save Schedule'}
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

        <WeeklyScheduleEditor week={draft} errors={visibleErrors} onChange={handleChange} disabled={saving} />
      </section>

      <ExceptionsManager
        exceptions={exceptions}
        createException={createException}
        deleteException={deleteException}
        reasonRequired={requireReason}
        onCreated={(created) => setExceptions((prev) => sortExceptions([...prev, created]))}
        onDeleted={(id) => setExceptions((prev) => prev.filter((ex) => ex.exceptionId !== id))}
      />

      {confirming && (
        <Modal
          title="Override this schedule?"
          description={
            subjectName
              ? `This replaces ${subjectName}'s weekly working hours and is recorded in the audit log.`
              : 'This replaces the weekly working hours and is recorded in the audit log.'
          }
          onClose={() => setConfirming(false)}
          closeDisabled={saving}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={saving}
                className="inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmOverride}
                disabled={saving}
                className="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {saving ? 'Saving…' : 'Confirm & Save'}
              </button>
            </>
          }
        >
          <FormField id="override-reason" label="Reason for the change" required error={reasonError ?? undefined}>
            {(describedBy) => (
              <textarea
                id="override-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(null);
                }}
                aria-invalid={Boolean(reasonError)}
                aria-required="true"
                aria-describedby={describedBy}
                placeholder="e.g. Covering a colleague's leave"
                className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            )}
          </FormField>
        </Modal>
      )}
    </div>
  );
};

export default ScheduleEditor;
