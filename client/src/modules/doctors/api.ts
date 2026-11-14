// ==============================================================================
// Appointly Client — Doctor API Calls
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.3 (F-003)
//   GET   /api/v1/doctors                          (PATIENT, DOCTOR, ADMIN)
//   POST  /api/v1/admin/doctors                    (ADMIN)
//   PUT   /api/v1/admin/doctors/:doctorId          (ADMIN)
//   PATCH /api/v1/admin/doctors/:doctorId/status   (ADMIN)
//   GET   /api/v1/doctors/:doctorId                (ADMIN: full record incl. every assigned service)
//   POST  /api/v1/admin/doctors/:doctorId/services (ADMIN)  F-005 assign
//   DELETE /api/v1/admin/doctors/:doctorId/services/:serviceId (ADMIN)  F-005 unassign
// The backend wraps payloads as { success, data, message }; we read `data`.
// ==============================================================================

import { apiClient, unwrapData } from '../../shared/api';
import { ApiResponse } from '../../shared/types';
import {
  CreateDoctorInput,
  Doctor,
  DoctorAssignment,
  ListDoctorsParams,
  ProfileStatus,
  UpdateDoctorInput,
} from './types';

export async function listDoctors({
  status,
  search,
  serviceId,
  signal,
}: ListDoctorsParams = {}): Promise<Doctor[]> {
  const params = new URLSearchParams();
  if (status && status !== 'ALL') params.set('status', status);
  const term = search?.trim();
  if (term) params.set('search', term);
  if (serviceId) params.set('serviceId', serviceId);

  const query = params.toString();
  const res = await apiClient.get<ApiResponse<Doctor[]>>(`/doctors${query ? `?${query}` : ''}`, {
    signal,
  });
  const data = unwrapData(res);
  return Array.isArray(data) ? data : [];
}

export async function createDoctor(input: CreateDoctorInput): Promise<Doctor> {
  const res = await apiClient.post<ApiResponse<Doctor>>('/admin/doctors', input);
  return unwrapData(res);
}

export async function updateDoctor(doctorId: string, input: UpdateDoctorInput): Promise<Doctor> {
  const res = await apiClient.put<ApiResponse<Doctor>>(
    `/admin/doctors/${encodeURIComponent(doctorId)}`,
    input
  );
  return unwrapData(res);
}

export async function updateDoctorStatus(
  doctorId: string,
  profileStatus: ProfileStatus
): Promise<Doctor> {
  const res = await apiClient.patch<ApiResponse<Doctor>>(
    `/admin/doctors/${encodeURIComponent(doctorId)}/status`,
    { profileStatus }
  );
  return unwrapData(res);
}

export async function getDoctor(doctorId: string, signal?: AbortSignal): Promise<Doctor> {
  const res = await apiClient.get<ApiResponse<Doctor>>(`/doctors/${encodeURIComponent(doctorId)}`, { signal });
  return unwrapData(res);
}

/** Assigns one service (F-005). 409 DUPLICATE_ASSIGNMENT when it is already assigned. */
export async function assignService(doctorId: string, serviceId: string): Promise<DoctorAssignment> {
  const res = await apiClient.post<ApiResponse<DoctorAssignment>>(
    `/admin/doctors/${encodeURIComponent(doctorId)}/services`,
    { serviceId }
  );
  return unwrapData(res);
}

/** Removes one assignment (F-005). 404 ASSIGNMENT_NOT_FOUND when it does not exist. */
export async function unassignService(doctorId: string, serviceId: string): Promise<void> {
  await apiClient.delete<ApiResponse<unknown>>(
    `/admin/doctors/${encodeURIComponent(doctorId)}/services/${encodeURIComponent(serviceId)}`
  );
}
