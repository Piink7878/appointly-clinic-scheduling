// ==============================================================================
// Appointly Client — Doctor Schedule API Calls
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.6 (F-006)
//   GET    /api/v1/doctors/me/schedule                 (DOCTOR) { weeklySchedules, exceptions }
//   PUT    /api/v1/doctors/me/schedule                 (DOCTOR) { shifts } — replaces ALL weekly shifts
//   POST   /api/v1/doctors/me/exceptions               (DOCTOR)
//   DELETE /api/v1/doctors/me/exceptions/:exceptionId  (DOCTOR)
// The backend wraps payloads as { success, data, message }; we read `data`.
// ==============================================================================

import { apiClient, unwrapData } from '../../shared/api';
import { ApiResponse } from '../../shared/types';
import {
  CreateExceptionInput,
  MySchedule,
  ScheduleException,
  ShiftInput,
  WeeklyShift,
} from './types';

export async function getMySchedule(signal?: AbortSignal): Promise<MySchedule> {
  const res = await apiClient.get<ApiResponse<Partial<MySchedule>>>('/doctors/me/schedule', { signal });
  const data = unwrapData(res) ?? {};
  return {
    weeklySchedules: Array.isArray(data.weeklySchedules) ? data.weeklySchedules : [],
    exceptions: Array.isArray(data.exceptions) ? data.exceptions : [],
  };
}

/** Atomically replaces the whole weekly schedule; resolves with the saved shifts. */
export async function saveMySchedule(shifts: ShiftInput[]): Promise<WeeklyShift[]> {
  const res = await apiClient.put<ApiResponse<{ weeklySchedules?: WeeklyShift[]; shifts?: WeeklyShift[] }>>(
    '/doctors/me/schedule',
    { shifts }
  );
  const data = unwrapData(res) ?? {};
  return data.weeklySchedules ?? data.shifts ?? [];
}

export async function createException(input: CreateExceptionInput): Promise<ScheduleException> {
  const res = await apiClient.post<ApiResponse<ScheduleException>>('/doctors/me/exceptions', input);
  return unwrapData(res);
}

export async function deleteException(exceptionId: string): Promise<void> {
  await apiClient.delete<ApiResponse<unknown>>(`/doctors/me/exceptions/${encodeURIComponent(exceptionId)}`);
}
