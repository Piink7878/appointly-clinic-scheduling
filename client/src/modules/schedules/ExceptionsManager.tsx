// ==============================================================================
// Appointly Client — Schedule Exceptions Manager (holidays / breaks / custom hours)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6 (F-006); AC-F006-03; SDS 4.3
// - POST   /api/v1/doctors/me/exceptions                { exceptionDate, exceptionType,
//          startTime?, endTime?, reason? }  (a HOLIDAY may be "Full day": null/null)
// - DELETE /api/v1/doctors/me/exceptions/:exceptionId   behind a confirmation modal
// Lists the configured exceptions (soonest first) with an empty state.
// ==============================================================================

import React, { useCallback, useState } from 'react';
import { CalendarOff, CalendarPlus, Trash2 } from 'lucide-react';
import { ApiClientError } from '../../shared/api';
import { AlertBanner, FormField, Modal } from '../../shared/components';
import { getBangkokToday, toDateInputValue } from '../../shared/utils';
import { type CreateExceptionInput, type ScheduleException } from './types';
import {
  EXCEPTION_TYPES,
  EXCEPTION_TYPE_LABELS,
  type ExceptionFormErrors,
  type ExceptionFormValues,
  REASON_MAX_LENGTH,
  allowsFullDay,
  emptyExceptionForm,
  formatTimeRange,
  toExceptionPayload,
  validateExceptionForm,
} from './validation';

export interface ExceptionsManagerProps {
  exceptions: ScheduleException[];
  /** Performs the POST (own schedule for a doctor, or a chosen doctor's for an admin). */
  createException: (input: CreateExceptionInput) => Promise<ScheduleException>;
  /** Performs the DELETE. */
  deleteException: (exceptionId: string) => Promise<void>;
  onCreated: (created: ScheduleException) => void;
  onDeleted: (exceptionId: string) => void;
  /** Administrator overrides must carry an audit reason (SDS 6.1). */
  reasonRequired?: boolean;
}

interface Feedback {
  variant: 'success' | 'error';
  message: string;
}

const inputClass = (invalid: boolean) =>
  `block w-full px-3 py-2.5 border rounded-lg text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 transition ${
    invalid
      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
      : 'border-slate-300 focus:ring-indigo-500 focus:border-indigo-500'
  }`;

/** "2026-12-31T00:00:00.000Z" -> "Thu, 31 Dec 2026" (the stored value is a calendar DATE, so no timezone shift). */
export const formatExceptionDate = (iso: string): string => {
  const value = toDateInputValue(iso);
  if (!value) return iso;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const ExceptionsManager: React.FC<ExceptionsManagerProps> = ({
  exceptions,
  createException,
  deleteException,
  onCreated,
  onDeleted,
  reasonRequired = false,
}) => {
  const [values, setValues] = useState<ExceptionFormValues>(emptyExceptionForm);
  const [errors, setErrors] = useState<ExceptionFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [toDelete, setToDelete] = useState<ScheduleException | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Stable identity so the banner's auto-dismiss timer is not restarted by every re-render.
  const dismissFeedback = useCallback(() => setFeedback(null), []);

  const today = getBangkokToday();
  const fullDayAllowed = allowsFullDay(values.exceptionType);
  const showTimes = !(fullDayAllowed && values.fullDay);

  const setField = <K extends keyof ExceptionFormValues>(field: K, value: ExceptionFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const found = validateExceptionForm(values, today, { reasonRequired });
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const created = await createException(toExceptionPayload(values));
      onCreated(created);
      setValues(emptyExceptionForm());
      setErrors({});
      setFeedback({
        variant: 'success',
        message: `${EXCEPTION_TYPE_LABELS[values.exceptionType]} added for ${formatExceptionDate(values.exceptionDate)}.`,
      });
    } catch (err) {
      setFeedback({
        variant: 'error',
        message: err instanceof Error && err.message ? err.message : 'Unable to add the exception.',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteException(toDelete.exceptionId);
      onDeleted(toDelete.exceptionId);
      setFeedback({
        variant: 'success',
        message: `${EXCEPTION_TYPE_LABELS[toDelete.exceptionType]} on ${formatExceptionDate(toDelete.exceptionDate)} removed.`,
      });
      setToDelete(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'EXCEPTION_NOT_FOUND') {
        // Already gone (another tab / device): drop it from the list.
        onDeleted(toDelete.exceptionId);
        setFeedback({ variant: 'error', message: 'That exception no longer exists; the list was refreshed.' });
        setToDelete(null);
      } else {
        setDeleteError(err instanceof Error && err.message ? err.message : 'Unable to remove the exception.');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section aria-labelledby="exceptions-heading" className="space-y-4">
      <div>
        <h2 id="exceptions-heading" className="text-lg font-semibold text-slate-900">
          Holidays &amp; Time Off
        </h2>
        <p className="text-sm text-slate-600">
          Block a whole day or a time window on a specific date. Patients cannot book blocked times.
        </p>
      </div>

      {feedback && (
        <AlertBanner
          variant={feedback.variant}
          message={feedback.message}
          onDismiss={dismissFeedback}
          autoDismissMs={feedback.variant === 'success' ? 5000 : undefined}
        />
      )}

      {/* Add form */}
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Add exception"
        className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="exception-date" label="Date" required error={errors.exceptionDate}>
            {(describedBy) => (
              <input
                id="exception-date"
                type="date"
                min={today}
                value={values.exceptionDate}
                onChange={(e) => setField('exceptionDate', e.target.value)}
                aria-invalid={Boolean(errors.exceptionDate)}
                aria-required="true"
                aria-describedby={describedBy}
                className={inputClass(Boolean(errors.exceptionDate))}
              />
            )}
          </FormField>

          <FormField id="exception-type" label="Type" required>
            {() => (
              <select
                id="exception-type"
                value={values.exceptionType}
                onChange={(e) => {
                  const next = e.target.value as ExceptionFormValues['exceptionType'];
                  setValues((prev) => ({ ...prev, exceptionType: next, fullDay: allowsFullDay(next) }));
                  setErrors((prev) => ({ ...prev, startTime: undefined, endTime: undefined }));
                }}
                className={inputClass(false)}
              >
                {EXCEPTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EXCEPTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        {fullDayAllowed && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={values.fullDay}
              onChange={(e) => setField('fullDay', e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Full day
          </label>
        )}

        {showTimes && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="exception-start" label="Start time" required error={errors.startTime}>
              {(describedBy) => (
                <input
                  id="exception-start"
                  type="time"
                  value={values.startTime}
                  onChange={(e) => setField('startTime', e.target.value)}
                  aria-invalid={Boolean(errors.startTime)}
                  aria-required="true"
                  aria-describedby={describedBy}
                  className={inputClass(Boolean(errors.startTime))}
                />
              )}
            </FormField>
            <FormField id="exception-end" label="End time" required error={errors.endTime}>
              {(describedBy) => (
                <input
                  id="exception-end"
                  type="time"
                  value={values.endTime}
                  onChange={(e) => setField('endTime', e.target.value)}
                  aria-invalid={Boolean(errors.endTime)}
                  aria-required="true"
                  aria-describedby={describedBy}
                  className={inputClass(Boolean(errors.endTime))}
                />
              )}
            </FormField>
          </div>
        )}

        <FormField
          id="exception-reason"
          label="Reason"
          required={reasonRequired}
          error={errors.reason}
          hint={reasonRequired ? 'Recorded in the audit log.' : 'Optional.'}
        >
          {(describedBy) => (
            <input
              id="exception-reason"
              type="text"
              autoComplete="off"
              value={values.reason}
              onChange={(e) => setField('reason', e.target.value)}
              maxLength={REASON_MAX_LENGTH + 50}
              aria-invalid={Boolean(errors.reason)}
              aria-required={reasonRequired ? 'true' : undefined}
              aria-describedby={describedBy}
              placeholder="e.g. National holiday, conference"
              className={inputClass(Boolean(errors.reason))}
            />
          )}
        </FormField>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <CalendarPlus className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {saving ? 'Adding…' : 'Add Exception'}
          </button>
        </div>
      </form>

      {/* List */}
      {exceptions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <CalendarOff className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No holidays or time off yet</h3>
          <p className="mt-1 text-sm text-slate-500">Add a date above to block it from patient bookings.</p>
        </div>
      ) : (
        <ul aria-label="Schedule exceptions" className="space-y-2">
          {exceptions.map((ex) => {
            const dateLabel = formatExceptionDate(ex.exceptionDate);
            const typeLabel = EXCEPTION_TYPE_LABELS[ex.exceptionType] ?? ex.exceptionType;
            return (
              <li
                key={ex.exceptionId}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{dateLabel}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800">
                      {typeLabel}
                    </span>
                    <span className="text-sm text-slate-600">{formatTimeRange(ex.startTime, ex.endTime)}</span>
                  </div>
                  {ex.reason && <p className="mt-1 text-sm text-slate-500 break-words">{ex.reason}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setToDelete(ex);
                  }}
                  aria-label={`Delete ${typeLabel} on ${dateLabel}`}
                  className="flex-shrink-0 inline-flex items-center px-2 py-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {toDelete && (
        <Modal
          title="Remove this exception?"
          onClose={() => setToDelete(null)}
          closeDisabled={deleting}
          footer={
            <>
              <button
                type="button"
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            {deleteError && <AlertBanner variant="error" message={deleteError} />}
            <p className="text-sm text-slate-700">
              <strong>{EXCEPTION_TYPE_LABELS[toDelete.exceptionType]}</strong> on{' '}
              <strong>{formatExceptionDate(toDelete.exceptionDate)}</strong> (
              {formatTimeRange(toDelete.startTime, toDelete.endTime)}) will be removed and the time becomes
              bookable again.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
};

export default ExceptionsManager;
