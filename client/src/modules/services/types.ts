// ==============================================================================
// Appointly Client — Service Catalog Types
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.4 (F-004) — camelCase DTOs returned by
// GET /api/v1/services and POST/PUT/PATCH /api/v1/admin/services.
// ==============================================================================

export type ServiceStatus = 'ACTIVE' | 'INACTIVE';

export interface MedicalService {
  serviceId: string;
  serviceName: string;
  description: string | null;
  durationMinutes: number;
  serviceStatus: ServiceStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** `ALL` is the UI-only "no filter" value; it is never sent to the API. */
export type ServiceStatusFilter = 'ALL' | ServiceStatus;

export interface ListServicesParams {
  status?: ServiceStatusFilter;
  search?: string;
  signal?: AbortSignal;
}

/** Body for POST (create) and PUT (update). */
export interface ServiceInput {
  serviceName: string;
  /** Always sent: the backend treats an omitted description as "clear it". */
  description: string | null;
  durationMinutes: number;
}
