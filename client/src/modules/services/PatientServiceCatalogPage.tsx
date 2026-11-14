// ==============================================================================
// Appointly Client — Patient Service Catalog (/patient/services)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.4 (F-004); AC-F004-01/02;
//            SDS Sections 4.2 & 4.3
// - GET /api/v1/services  (PATIENT receives ACTIVE services only — FR-018, BR-004)
// - Cards with name, description, a duration badge (e.g. "45 mins") and a
//   "View available doctors" link to /patient/doctors?serviceId=<id> (F-005)
// - Skeleton cards while loading, guided empty state, error banner with retry
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { Clock, Stethoscope, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AlertBanner, Skeleton } from '../../shared/components';
import { listServices } from './api';
import { MedicalService } from './types';
import { formatDuration } from './validation';

export const PatientServiceCatalogPage: React.FC = () => {
  const [services, setServices] = useState<MedicalService[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    listServices({ signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        // Defence in depth: the API already hides inactive services from patients (BR-004).
        setServices(result.filter((s) => s.serviceStatus === 'ACTIVE'));
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setServices(null);
        setError(err instanceof Error && err.message ? err.message : 'Unable to load services.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey]);

  const items = services ?? [];
  const showEmpty = !isLoading && error === null && services !== null && items.length === 0;
  const showCards = !isLoading && error === null && items.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Our Services</h1>
        <p className="mt-1 text-sm text-slate-600">
          Browse the medical services offered by the clinic and their standard appointment length.
        </p>
      </div>

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
      {isLoading && (
        <div
          aria-busy="true"
          aria-label="Loading services"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-6 w-20 rounded-full" />
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
          <h2 className="text-base font-semibold text-slate-900">No services available</h2>
          <p className="mt-1 text-sm text-slate-500">
            There are no active services at the moment. Please check back soon, or{' '}
            <Link to="/patient/doctors" className="text-sky-700 underline hover:text-sky-900">
              browse our doctors
            </Link>
            .
          </p>
        </div>
      )}

      {/* Service cards */}
      {showCards && (
        <ul aria-label="Service list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((s) => (
            <li
              key={s.serviceId}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3"
            >
              <h2 className="text-base font-semibold text-slate-900 break-words">{s.serviceName}</h2>
              <p className="text-sm text-slate-600 break-words flex-1">
                {s.description || <span className="text-slate-400">No description provided.</span>}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-100">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {formatDuration(s.durationMinutes)}
                </span>
                <Link
                  to={`/patient/doctors?serviceId=${encodeURIComponent(s.serviceId)}`}
                  aria-label={`View available doctors for ${s.serviceName}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                  View available doctors
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PatientServiceCatalogPage;
