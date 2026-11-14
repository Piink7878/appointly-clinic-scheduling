// ==============================================================================
// Appointly Client — Patient Doctor Directory (/patient/doctors)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.3 (F-003) and 1.5 (F-005);
//            AC-F003-01/02, AC-F005-03; SDS Sections 4.2 & 4.3
// - GET /api/v1/doctors[?serviceId=]  (PATIENT receives ACTIVE doctors only)
// - Cards with specialization and service badges (only ACTIVE services, BR-004)
// - Skeleton cards while loading, guided empty state, error banner with retry
// - `?serviceId=` (linked from the service catalog) narrows to qualified doctors
// Only public-facing fields are displayed: contact e-mail, licence number and
// account ids are intentionally not rendered to patients.
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, Stethoscope, UserRound, X } from 'lucide-react';
import { AlertBanner, Skeleton } from '../../shared/components';
import { listDoctors } from './api';
import { Doctor } from './types';

const initialsOf = (name: string): string =>
  name
    .replace(/^(dr\.?|doctor)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const durationLabel = (minutes: number): string => `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;

export const PatientDoctorsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceId = searchParams.get('serviceId')?.trim() || '';

  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    listDoctors({ serviceId: serviceId || undefined, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        // Defence in depth: the API already hides inactive doctors from patients (BR-003).
        setDoctors(result.filter((d) => d.profileStatus === 'ACTIVE'));
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setDoctors(null);
        setError(err instanceof Error && err.message ? err.message : 'Unable to load doctors.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [serviceId, reloadKey]);

  const items = doctors ?? [];
  const showSkeleton = isLoading;
  const showEmpty = !isLoading && error === null && doctors !== null && items.length === 0;
  const showCards = !isLoading && error === null && items.length > 0;

  // Name of the service we are filtering by, when any returned doctor carries it.
  const filteredServiceName = serviceId
    ? items.flatMap((d) => d.services ?? []).find((s) => s.serviceId === serviceId)?.serviceName
    : undefined;

  const clearServiceFilter = () => setSearchParams({}, { replace: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Find a Doctor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Browse the clinic&rsquo;s active doctors, their specialties and the services they offer.
        </p>
      </div>

      {serviceId && (
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 border border-sky-200 pl-3 pr-1.5 py-1 text-sm text-sky-900">
          <span>
            Showing doctors for <strong>{filteredServiceName ?? 'the selected service'}</strong>
          </span>
          <button
            type="button"
            onClick={clearServiceFilter}
            aria-label="Remove service filter"
            className="rounded-full p-1 text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <AlertBanner
          variant="error"
          message={error}
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

      {/* Loading skeleton cards */}
      {showSkeleton && (
        <div
          aria-busy="true"
          aria-label="Loading doctors"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <Stethoscope className="w-6 h-6" />
          </div>
          {serviceId ? (
            <>
              <h2 className="text-base font-semibold text-slate-900">No doctors available for this service</h2>
              <p className="mt-1 text-sm text-slate-500">
                No active doctor currently offers this service. Please check back later or browse all doctors.
              </p>
              <button
                type="button"
                onClick={clearServiceFilter}
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                Show all doctors
              </button>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-900">No doctors available</h2>
              <p className="mt-1 text-sm text-slate-500">
                There are no active doctors at the moment. Please check back soon, or{' '}
                <Link to="/patient/services" className="text-sky-700 underline hover:text-sky-900">
                  browse our services
                </Link>
                .
              </p>
            </>
          )}
        </div>
      )}

      {/* Doctor cards */}
      {showCards && (
        <ul aria-label="Doctor list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((d) => {
            const services = (d.services ?? []).filter((s) => s.serviceStatus === 'ACTIVE');
            return (
              <li
                key={d.doctorId}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="w-12 h-12 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold flex-shrink-0"
                  >
                    {initialsOf(d.fullName) || <UserRound className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 break-words">{d.fullName}</h2>
                    <p className="text-sm text-slate-600 flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
                      <span className="break-words">{d.specialization}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Services</h3>
                  {services.length > 0 ? (
                    <ul aria-label={`Services offered by ${d.fullName}`} className="flex flex-wrap gap-2">
                      {services.map((s) => (
                        <li
                          key={s.serviceId}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100"
                        >
                          {s.serviceName}
                          <span className="inline-flex items-center text-emerald-600">
                            <Clock className="w-3 h-3 mx-0.5" aria-hidden="true" />
                            {durationLabel(s.durationMinutes)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">No services assigned yet.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default PatientDoctorsPage;
