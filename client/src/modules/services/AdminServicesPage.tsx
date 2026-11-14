// ==============================================================================
// Appointly Client — Admin Service Catalog (/admin/services)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.4 (F-004); AC-F004-01..03;
//            SDS Sections 4.2 & 4.3
// - GET   /api/v1/services?status=&search=   (ADMIN sees ACTIVE and INACTIVE)
// - Add (POST) / Edit (PUT) in a modal; Activate/Deactivate (PATCH) behind a
//   confirmation modal; success / error banners
// - Table on >= md, stacked cards below md (NFR-022)
// - Skeleton while loading, guided empty states, error banner with retry
// ==============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, Pencil, Plus, Power, Search, SearchX, X } from 'lucide-react';
import { AlertBanner, Skeleton, StatusBadge } from '../../shared/components';
import { useDebouncedValue } from '../../shared/hooks';
import { listServices } from './api';
import { ServiceFormModal } from './ServiceFormModal';
import { ServiceStatusModal } from './ServiceStatusModal';
import { MedicalService, ServiceStatusFilter } from './types';
import { formatDuration } from './validation';

export const SEARCH_DEBOUNCE_MS = 300;

type ModalState =
  | { type: 'create' }
  | { type: 'edit'; service: MedicalService }
  | { type: 'status'; service: MedicalService }
  | null;

const STATUS_OPTIONS: { value: ServiceStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const secondaryButton =
  'inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500';

export const AdminServicesPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>('ALL');

  const [services, setServices] = useState<MedicalService[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [modal, setModal] = useState<ModalState>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    listServices({ status: statusFilter, search: debouncedSearch, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setServices(result);
        setIsLoading(false);
      })
      .catch((err) => {
        // A newer request superseded this one (or the page unmounted): ignore.
        if (controller.signal.aborted) return;
        setServices(null);
        setError(err instanceof Error && err.message ? err.message : 'Unable to load services.');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, statusFilter, reloadKey]);

  const items = services ?? [];
  const hasFilters = debouncedSearch !== '' || statusFilter !== 'ALL';

  // Skeleton whenever we are loading and have nothing to show; otherwise dim the old rows.
  const isInitialLoad = isLoading && items.length === 0 && error === null;
  const showEmpty = !isLoading && error === null && services !== null && items.length === 0;
  const showResults = error === null && items.length > 0;

  // Stable identity so the banner's auto-dismiss timer is not restarted by every re-render.
  const dismissBanner = useCallback(() => setBanner(null), []);
  const closeModal = () => setModal(null);
  const handleDone = (message: string) => {
    setModal(null);
    setBanner(message);
    setReloadKey((k) => k + 1);
  };
  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('ALL');
  };

  const actionButtons = (s: MedicalService) => (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setModal({ type: 'edit', service: s })}
        aria-label={`Edit ${s.serviceName}`}
        className={secondaryButton}
      >
        <Pencil className="w-3.5 h-3.5 mr-1" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => setModal({ type: 'status', service: s })}
        aria-label={`${s.serviceStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${s.serviceName}`}
        className={`${secondaryButton} ${
          s.serviceStatus === 'ACTIVE' ? 'hover:text-red-700' : 'hover:text-emerald-700'
        }`}
      >
        <Power className="w-3.5 h-3.5 mr-1" />
        {s.serviceStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Catalog</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage the medical services patients can book and control which ones are visible.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: 'create' })}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg shadow-sm text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
        >
          <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
          Add New Service
        </button>
      </div>

      {banner && (
        <AlertBanner variant="success" message={banner} onDismiss={dismissBanner} autoDismissMs={6000} />
      )}

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <label htmlFor="service-search" className="sr-only">
            Search services
          </label>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="service-search"
            type="text"
            inputMode="search"
            autoComplete="off"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or description"
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
        <div>
          <label htmlFor="service-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="service-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ServiceStatusFilter)}
            className="block w-full sm:w-auto px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
          aria-label="Loading services"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            {hasFilters ? <SearchX className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
          </div>
          {hasFilters ? (
            <>
              <h2 className="text-base font-semibold text-slate-900">No services found</h2>
              <p className="mt-1 text-sm text-slate-500">
                No services match the current search or status filter.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-slate-900">No services yet</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add the first service to start building the clinic&rsquo;s catalog.
              </p>
              <button
                type="button"
                onClick={() => setModal({ type: 'create' })}
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Add your first service
              </button>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div aria-busy={isLoading} className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* Desktop / tablet: table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <caption className="sr-only">Medical service catalog</caption>
              <thead className="bg-slate-50">
                <tr>
                  {['Service', 'Description', 'Duration', 'Status', 'Actions'].map((h) => (
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
                {items.map((s) => (
                  <tr key={s.serviceId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{s.serviceName}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-md break-words">
                      {s.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {formatDuration(s.durationMinutes)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={s.serviceStatus} />
                    </td>
                    <td className="px-4 py-3 text-sm">{actionButtons(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="md:hidden space-y-3" aria-label="Service list">
            {items.map((s) => (
              <li key={s.serviceId} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900 break-words">{s.serviceName}</h3>
                  <StatusBadge status={s.serviceStatus} />
                </div>
                <p className="mt-1 text-sm text-slate-600 break-words">{s.description || '—'}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Duration: <span className="text-slate-700">{formatDuration(s.durationMinutes)}</span>
                </p>
                <div className="mt-3">{actionButtons(s)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modal?.type === 'create' && <ServiceFormModal mode="create" onClose={closeModal} onSaved={handleDone} />}
      {modal?.type === 'edit' && (
        <ServiceFormModal mode="edit" service={modal.service} onClose={closeModal} onSaved={handleDone} />
      )}
      {modal?.type === 'status' && (
        <ServiceStatusModal service={modal.service} onClose={closeModal} onChanged={handleDone} />
      )}
    </div>
  );
};

export default AdminServicesPage;
