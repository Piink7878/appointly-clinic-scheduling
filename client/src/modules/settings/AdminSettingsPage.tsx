// ==============================================================================
// Appointly Client — Admin Clinic Settings (/admin/settings)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7 (F-007); AC-F007-01/02/03;
//            SDS Sections 4.2 & 4.3
// - Loads GET /api/v1/settings/public, edits clinicName, timezone (default
//   Asia/Bangkok), fixedStartIntervalMinutes (5, 10, 15, 20, 30, 60) and
//   cancellationCutoffHours, and saves with PATCH /api/v1/admin/settings.
// - Inline validation, success toast, backend error banner, skeleton, retry.
// ==============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Undo2 } from 'lucide-react';
import { AlertBanner, FormField, Skeleton, fieldInputClass } from '../../shared/components';
import { getPublicSettings, updateSettings } from './api';
import { type ClinicSettings } from './types';
import {
  CLINIC_NAME_MAX,
  CUTOFF_HOURS_MAX,
  FIXED_START_INTERVALS,
  type SettingsFormErrors,
  type SettingsFormValues,
  getTimezoneOptions,
  isSettingsDirty,
  settingsToForm,
  toSettingsInput,
  validateSettingsForm,
} from './validation';

interface Feedback {
  variant: 'success' | 'error';
  message: string;
}

export const AdminSettingsPage: React.FC = () => {
  const [saved, setSaved] = useState<ClinicSettings | null>(null);
  const [values, setValues] = useState<SettingsFormValues | null>(null);
  const [errors, setErrors] = useState<SettingsFormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Stable identity so the banner's auto-dismiss timer is not restarted by every re-render.
  const dismissFeedback = useCallback(() => setFeedback(null), []);
  const timezoneOptions = useMemo(getTimezoneOptions, []);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);

    getPublicSettings(controller.signal)
      .then((settings) => {
        if (controller.signal.aborted) return;
        setSaved(settings);
        setValues(settingsToForm(settings));
        setErrors({});
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof Error && err.message ? err.message : 'Unable to load clinic settings.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const setField = (field: keyof SettingsFormValues, value: string) => {
    setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setFeedback(null);
  };

  const dirty = saved !== null && values !== null && isSettingsDirty(values, saved);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !values) return;

    const found = validateSettingsForm(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFeedback(null);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateSettings(toSettingsInput(values));
      setSaved(updated);
      setValues(settingsToForm(updated));
      setErrors({});
      setFeedback({ variant: 'success', message: 'Clinic settings saved successfully.' });
    } catch (err) {
      setFeedback({
        variant: 'error',
        message: err instanceof Error && err.message ? err.message : 'Unable to save clinic settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!saved) return;
    setValues(settingsToForm(saved));
    setErrors({});
    setFeedback(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clinic Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure how the clinic generates appointment times and when patients can still cancel. Every change is
          recorded in the audit log.
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
        <div
          aria-busy="true"
          aria-label="Loading settings"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-2xl"
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !loadError && values && (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Clinic settings"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-2xl"
        >
          {feedback && (
            <AlertBanner
              variant={feedback.variant}
              message={feedback.message}
              onDismiss={dismissFeedback}
              autoDismissMs={feedback.variant === 'success' ? 5000 : undefined}
            />
          )}

          <FormField id="setting-clinic-name" label="Clinic name" required error={errors.clinicName}>
            {(describedBy) => (
              <input
                id="setting-clinic-name"
                type="text"
                autoComplete="off"
                value={values.clinicName}
                onChange={(e) => setField('clinicName', e.target.value)}
                maxLength={CLINIC_NAME_MAX + 50}
                aria-invalid={Boolean(errors.clinicName)}
                aria-required="true"
                aria-describedby={describedBy}
                className={fieldInputClass(Boolean(errors.clinicName))}
              />
            )}
          </FormField>

          <FormField
            id="setting-timezone"
            label="Timezone"
            required
            error={errors.timezone}
            hint="IANA timezone identifier. Appointments and schedules use this clock. Default: Asia/Bangkok."
          >
            {(describedBy) => (
              <>
                <input
                  id="setting-timezone"
                  type="text"
                  list="timezone-options"
                  autoComplete="off"
                  spellCheck={false}
                  value={values.timezone}
                  onChange={(e) => setField('timezone', e.target.value)}
                  aria-invalid={Boolean(errors.timezone)}
                  aria-required="true"
                  aria-describedby={describedBy}
                  className={fieldInputClass(Boolean(errors.timezone))}
                />
                <datalist id="timezone-options">
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              </>
            )}
          </FormField>

          <FormField
            id="setting-interval"
            label="Fixed start interval"
            required
            error={errors.fixedStartIntervalMinutes}
            hint="Appointment start times are offered every N minutes (default 15)."
          >
            {(describedBy) => (
              <select
                id="setting-interval"
                value={values.fixedStartIntervalMinutes}
                onChange={(e) => setField('fixedStartIntervalMinutes', e.target.value)}
                aria-invalid={Boolean(errors.fixedStartIntervalMinutes)}
                aria-required="true"
                aria-describedby={describedBy}
                className={fieldInputClass(Boolean(errors.fixedStartIntervalMinutes))}
              >
                {FIXED_START_INTERVALS.map((minutes) => (
                  <option key={minutes} value={String(minutes)}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            id="setting-cutoff"
            label="Cancellation cutoff (hours)"
            required
            error={errors.cancellationCutoffHours}
            hint={`Patients can cancel or reschedule only until this many hours before the appointment (default 24). 0 means any time before it starts. Maximum ${CUTOFF_HOURS_MAX}.`}
          >
            {(describedBy) => (
              <input
                id="setting-cutoff"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={values.cancellationCutoffHours}
                onChange={(e) => setField('cancellationCutoffHours', e.target.value)}
                aria-invalid={Boolean(errors.cancellationCutoffHours)}
                aria-required="true"
                aria-describedby={describedBy}
                className={fieldInputClass(Boolean(errors.cancellationCutoffHours))}
              />
            )}
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!dirty || saving}
              className="inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <Undo2 className="w-4 h-4 mr-1.5" aria-hidden="true" />
              Discard changes
            </button>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="inline-flex justify-center items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
            >
              <Save className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminSettingsPage;
