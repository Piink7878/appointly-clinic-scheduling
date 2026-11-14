// ==============================================================================
// Appointly Client — Patient API Calls
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.2 (F-002)
//   GET /api/v1/patients/me        (PATIENT)
//   PUT /api/v1/patients/me        (PATIENT)
//   GET /api/v1/admin/patients     (ADMIN)  ?search=&page=&limit=
// The backend wraps payloads as { success, data, message }; we read `data`.
// ==============================================================================

import { apiClient, unwrapData as unwrap } from '../../shared/api';
import { ApiResponse } from '../../shared/types';
import {
  ListPatientsParams,
  PatientListResult,
  PatientProfile,
  UpdatePatientProfileInput,
} from './types';

export const DEFAULT_PAGE_SIZE = 20;

export async function getMyProfile(signal?: AbortSignal): Promise<PatientProfile> {
  const res = await apiClient.get<ApiResponse<PatientProfile>>('/patients/me', { signal });
  return unwrap(res);
}

export async function updateMyProfile(input: UpdatePatientProfileInput): Promise<PatientProfile> {
  const res = await apiClient.put<ApiResponse<PatientProfile>>('/patients/me', input);
  return unwrap(res);
}

export async function listPatients({
  search,
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  signal,
}: ListPatientsParams = {}): Promise<PatientListResult> {
  const params = new URLSearchParams();
  const term = search?.trim();
  if (term) params.set('search', term);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const res = await apiClient.get<ApiResponse<PatientListResult>>(
    `/admin/patients?${params.toString()}`,
    { signal }
  );
  const data = unwrap(res);
  return {
    items: data.items ?? [],
    total: data.total ?? 0,
    page: data.page ?? page,
    limit: data.limit ?? limit,
  };
}
