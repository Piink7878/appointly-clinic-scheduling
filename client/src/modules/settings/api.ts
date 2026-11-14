// ==============================================================================
// Appointly Client — Clinic Settings API Calls
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7 (F-007)
//   GET   /api/v1/settings/public   { clinicName, timezone, fixedStartIntervalMinutes,
//                                     cancellationCutoffHours }
//   PATCH /api/v1/admin/settings    (ADMIN) partial update; returns the stored record
// The backend wraps payloads as { success, data, message }; we read `data`.
// ==============================================================================

import { apiClient, unwrapData } from '../../shared/api';
import { type ApiResponse } from '../../shared/types';
import { type ClinicSettings, type UpdateSettingsInput } from './types';

const pick = (data: Partial<ClinicSettings>): ClinicSettings => ({
  clinicName: data.clinicName ?? '',
  timezone: data.timezone ?? '',
  fixedStartIntervalMinutes: Number(data.fixedStartIntervalMinutes),
  cancellationCutoffHours: Number(data.cancellationCutoffHours),
});

export async function getPublicSettings(signal?: AbortSignal): Promise<ClinicSettings> {
  const res = await apiClient.get<ApiResponse<Partial<ClinicSettings>>>('/settings/public', { signal });
  return pick(unwrapData(res) ?? {});
}

export async function updateSettings(input: UpdateSettingsInput): Promise<ClinicSettings> {
  const res = await apiClient.patch<ApiResponse<Partial<ClinicSettings>>>('/admin/settings', input);
  return pick(unwrapData(res) ?? {});
}
