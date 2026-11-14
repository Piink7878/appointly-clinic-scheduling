// ==============================================================================
// Appointly Client — Admin Patient Directory (/admin/patients)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.2 (F-002); SDS Sections 4.2 & 4.3
// - GET /api/v1/admin/patients?search=&page=&limit=
// - Debounced search by name, email or phone number
// - Table on >= md, stacked cards below md (NFR-022)
// - Skeleton while loading, guided empty state, error banner with retry
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, SearchX, Users, X } from 'lucide-react';
import { ApiClientError } from '../../shared/api';
import { AlertBanner, Skeleton, StatusBadge } from '../../shared/components';
import { useDebouncedValue } from '../../shared/hooks';
import { formatDate } from '../../shared/utils';
import { DEFAULT_PAGE_SIZE, listPatients } from './api';
import { PatientDirectoryItem, PatientListResult } from './types';

export const SEARCH_DEBOUNCE_MS = 300;

const dobOf = (p: PatientDirectoryItem): string => (p.dateOfBirth ? formatDate(p.dateOfBirth) : '—');

export const AdminPatientsPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);

  // The page number is remembered together with the search it belongs to, so a
  // new search automatically starts on page 1 without a reset effect (which
  // would trigger a second, redundant request).
  const [pageState, setPageState] = useState({ forSearch: '', page: 1 });
  const page = pageState.forSearch === debouncedSearch ? pageState.page : 1;

  const [data, setData] = useState<PatientListResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    listPatients({ search: debouncedSearch, page, limit: DEFAULT_PAGE_SIZE, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setIsLoading(false);
      })
      .catch((err) => {
        // A newer request superseded this one (or the page unmounted): ignore.
        if (controller.signal.aborted) return;
        setData(null);
        setError(
          err instanceof ApiClientError || err instanceof Error
            ? err.message || 'Unable to load patients.'
            : 'Unable to load patients.'
        );
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, page, reloadKey]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(total, page * limit);

  // Skeleton whenever we are loading and have nothing to show (first load, or a
  // refetch that follows an empty/failed result); otherwise dim the old rows.
  const isInitialLoad = isLoading && items.length === 0 && error === null;
  const showEmpty = !isLoading && error === null && data !== null && items.length === 0;
  const showResults = error === null && items.length > 0;
  const activeSearch = debouncedSearch;

  const goToPage = (next: number) => setPageState({ forSearch: debouncedSearch, page: next });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Directory</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search registered patients by name, email address or phone number.
          </p>
        </div>

        <div className="w-full sm:max-w-sm">
          <label htmlFor="patient-search" className="sr-only">
            Search patients
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              id="patient-search"
              type="text"
              inputMode="search"
              autoComplete="off"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, email or phone"
              className="block w-full pl-10 pr-9 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
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

      {/* Loading skeleton (first load) */}
      {isInitialLoad && (
        <div
          aria-busy="true"
          aria-label="Loading patients"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/5" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            {activeSearch ? <SearchX className="w-6 h-6" /> : <Users className="w-6 h-6" />}
          </div>
          {activeSearch ? (
            <>
              <h2 className="text-base font-semibold text-slate-900">No patients found</h2>
              <p className="mt-1 text-sm text-slate-500">
                No patients match &ldquo;{activeSearch}&rdquo;. Check the spelling or try a different name, email or
                phone number.
              </p>
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-900">No patients yet</h2>
              <p className="mt-1 text-sm text-slate-500">Registered patients will appear here.</p>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div aria-busy={isLoading} className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* Desktop / tablet: table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <caption className="sr-only">Patient directory</caption>
              <thead className="bg-slate-50">
                <tr>
                  {['Name', 'Email', 'Phone', 'Date of Birth', 'Status'].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p.patientId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.fullName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 break-all">{p.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{p.phoneNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{dobOf(p)}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={p.accountStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="md:hidden space-y-3" aria-label="Patient list">
            {items.map((p) => (
              <li key={p.patientId} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">{p.fullName}</h3>
                  <StatusBadge status={p.accountStatus} />
                </div>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-12 text-slate-400 flex-shrink-0">Email</dt>
                    <dd className="text-slate-700 break-all">{p.email}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 text-slate-400 flex-shrink-0">Phone</dt>
                    <dd className="text-slate-700">{p.phoneNumber}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 text-slate-400 flex-shrink-0">DOB</dt>
                    <dd className="text-slate-700">{dobOf(p)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Showing {rangeStart}&ndash;{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || isLoading}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
};

export default AdminPatientsPage;
