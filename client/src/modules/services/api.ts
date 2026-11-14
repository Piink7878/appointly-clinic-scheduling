// ==============================================================================
// Appointly Client — Service Catalog API Calls
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.4 (F-004)
//   GET   /api/v1/services                          (PATIENT: ACTIVE only; ADMIN: all)
//   POST  /api/v1/admin/services                    (ADMIN)
//   PUT   /api/v1/admin/services/:serviceId         (ADMIN)
//   PATCH /api/v1/admin/services/:serviceId/status  (ADMIN)
// The backend wraps payloads as { success, data, message }; we read `data`.
// ==============================================================================

import { apiClient, unwrapData } from '../../shared/api';
import { ApiResponse } from '../../shared/types';
import { ListServicesParams, MedicalService, ServiceInput, ServiceStatus } from './types';

export async function listServices({
  status,
  search,
  signal,
}: ListServicesParams = {}): Promise<MedicalService[]> {
  const params = new URLSearchParams();
  if (status && status !== 'ALL') params.set('status', status);
  const term = search?.trim();
  if (term) params.set('search', term);

  const query = params.toString();
  const res = await apiClient.get<ApiResponse<MedicalService[]>>(
    `/services${query ? `?${query}` : ''}`,
    { signal }
  );
  const data = unwrapData(res);
  return Array.isArray(data) ? data : [];
}

export async function createService(input: ServiceInput): Promise<MedicalService> {
  const res = await apiClient.post<ApiResponse<MedicalService>>('/admin/services', input);
  return unwrapData(res);
}

export async function updateService(serviceId: string, input: ServiceInput): Promise<MedicalService> {
  const res = await apiClient.put<ApiResponse<MedicalService>>(
    `/admin/services/${encodeURIComponent(serviceId)}`,
    input
  );
  return unwrapData(res);
}

export async function updateServiceStatus(
  serviceId: string,
  serviceStatus: ServiceStatus
): Promise<MedicalService> {
  const res = await apiClient.patch<ApiResponse<MedicalService>>(
    `/admin/services/${encodeURIComponent(serviceId)}/status`,
    { serviceStatus }
  );
  return unwrapData(res);
}
