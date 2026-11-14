// ==============================================================================
// Appointly Client — Patient Profile Page (/patient/profile)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.2 (F-002), AC-F002-01/03;
//            SDS Sections 4.2 & 4.3
// - GET /api/v1/patients/me  -> populates the form (skeleton while loading)
// - PUT /api/v1/patients/me  -> saves fullName, phoneNumber, optional dateOfBirth
// - Success toast + backend validation error banner
// ==============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Mail, Save, User } from 'lucide-react';
import { useAuth } from '../../shared/context/AuthContext';
import { ApiClientError } from '../../shared/api';
import { AlertBanner, Skeleton } from '../../shared/components';
import { getMaxDobDate, toDateInputValue } from '../../shared/utils';
import { getMyProfile, updateMyProfile } from './api';
import { PatientProfile } from './types';
import {
  normalizePhone,
  ProfileFormErrors,
  ProfileFormValues,
  validateProfileForm,
} from './validation';

type LoadState = 'loading' | 'ready' | 'error';

interface Banner {
  variant: 'success' | 'error';
  message: string;
}

const toFormValues = (profile: PatientProfile): ProfileFormValues => ({
  fullName: profile.fullName ?? '',
  phoneNumber: profile.phoneNumber ?? '',
  dateOfBirth: toDateInputValue(profile.dateOfBirth),
});

const inputClass = (hasError: boolean) =>
  `block w-full px-3 py-2.5 border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 text-sm transition ${
    hasError
      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
      : 'border-slate-300 focus:ring-sky-500 focus:border-sky-500'
  }`;

const errorMessageOf = (err: unknown, fallback: string): string => {
  if (err instanceof ApiClientError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
};

export const PatientProfilePage: React.FC = () => {
  const { refreshUser } = useAuth();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [form, setForm] = useState<ProfileFormValues>({ fullName: '', phoneNumber: '', dateOfBirth: '' });
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const dismissBanner = useCallback(() => setBanner(null), []);

  // Load the authenticated patient's profile (aborted on unmount / retry)
  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    setLoadError(null);

    getMyProfile(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setProfile(data);
        setForm(toFormValues(data));
        setLoadState('ready');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setLoadError(errorMessageOf(err, 'Unable to load your profile. Please try again.'));
        setLoadState('error');
      });

    return () => controller.abort();
  }, [reloadKey]);

  const baseline = profile ? toFormValues(profile) : null;
  const isDirty =
    baseline !== null &&
    (form.fullName !== baseline.fullName ||
      form.phoneNumber !== baseline.phoneNumber ||
      form.dateOfBirth !== baseline.dateOfBirth);

  const handleChange =
    (field: keyof ProfileFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setBanner(null);

    const fieldErrors = validateProfileForm(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setIsSaving(true);
    try {
      const updated = await updateMyProfile({
        fullName: form.fullName.trim(),
        phoneNumber: normalizePhone(form.phoneNumber),
        // Backend: '' -> 400, undefined -> unchanged, null -> clears the field.
        dateOfBirth: form.dateOfBirth || null,
      });
      setProfile(updated);
      setForm(toFormValues(updated));
      setBanner({ variant: 'success', message: 'Profile updated successfully.' });
      // Keep the header identity (name) in sync with the saved profile.
      void refreshUser();
    } catch (err) {
      setBanner({
        variant: 'error',
        message: errorMessageOf(err, 'Unable to save your profile. Please try again.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Keep your contact details up to date so the clinic can reach you about appointments.
        </p>
      </div>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onDismiss={dismissBanner}
          autoDismissMs={banner.variant === 'success' ? 5000 : undefined}
        />
      )}

      {loadState === 'loading' && (
        <div
          aria-busy="true"
          aria-label="Loading profile"
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5"
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-32" />
        </div>
      )}

      {loadState === 'error' && (
        <AlertBanner
          variant="error"
          message={loadError ?? 'Unable to load your profile.'}
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

      {loadState === 'ready' && profile && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5"
        >
          {/* Email (read-only) */}
          <div>
            <label htmlFor="profile-email" className="block text-sm font-semibold text-slate-700">
              Email Address
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="profile-email"
                type="email"
                value={profile.email}
                readOnly
                aria-readonly="true"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Your sign-in email cannot be changed here.</p>
          </div>

          {/* Full name */}
          <div>
            <label htmlFor="profile-fullName" className="block text-sm font-semibold text-slate-700">
              Full Name
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <input
                id="profile-fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                maxLength={150}
                value={form.fullName}
                onChange={handleChange('fullName')}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby={errors.fullName ? 'profile-fullName-error' : undefined}
                className={`${inputClass(Boolean(errors.fullName))} pl-10`}
              />
            </div>
            {errors.fullName && (
              <p id="profile-fullName-error" className="mt-1 text-xs text-red-600">
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Phone number */}
          <div>
            <label htmlFor="profile-phoneNumber" className="block text-sm font-semibold text-slate-700">
              Phone Number
            </label>
            <input
              id="profile-phoneNumber"
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              value={form.phoneNumber}
              onChange={handleChange('phoneNumber')}
              placeholder="0812345678"
              aria-invalid={Boolean(errors.phoneNumber)}
              aria-describedby={errors.phoneNumber ? 'profile-phoneNumber-error' : 'profile-phoneNumber-hint'}
              className={`mt-1 ${inputClass(Boolean(errors.phoneNumber))}`}
            />
            {errors.phoneNumber ? (
              <p id="profile-phoneNumber-error" className="mt-1 text-xs text-red-600">
                {errors.phoneNumber}
              </p>
            ) : (
              <p id="profile-phoneNumber-hint" className="mt-1 text-xs text-slate-500">
                Thai mobile (e.g. 0812345678) or international format (e.g. +66812345678).
              </p>
            )}
          </div>

          {/* Date of birth */}
          <div>
            <label htmlFor="profile-dateOfBirth" className="block text-sm font-semibold text-slate-700">
              Date of Birth <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="profile-dateOfBirth"
              name="dateOfBirth"
              type="date"
              max={getMaxDobDate()}
              value={form.dateOfBirth}
              onChange={handleChange('dateOfBirth')}
              aria-invalid={Boolean(errors.dateOfBirth)}
              aria-describedby={errors.dateOfBirth ? 'profile-dateOfBirth-error' : undefined}
              className={`mt-1 ${inputClass(Boolean(errors.dateOfBirth))}`}
            />
            {errors.dateOfBirth && (
              <p id="profile-dateOfBirth-error" className="mt-1 text-xs text-red-600">
                {errors.dateOfBirth}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PatientProfilePage;
