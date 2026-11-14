// ==============================================================================
// Appointly Client — Doctor Module Types
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.3 (F-003) — camelCase DTOs returned by
// GET/POST/PUT/PATCH /api/v1/(admin/)doctors.
// ==============================================================================

export type ProfileStatus = 'ACTIVE' | 'INACTIVE';

/** Medical service as embedded in a doctor record (via DoctorService). */
export interface DoctorServiceSummary {
  serviceId: string;
  serviceName: string;
  description?: string | null;
  durationMinutes: number;
  serviceStatus: ProfileStatus;
}

export interface Doctor {
  doctorId: string;
  userId: string;
  email?: string;
  fullName: string;
  specialization: string;
  professionalLicenseNumber: string | null;
  profileStatus: ProfileStatus;
  accountStatus?: ProfileStatus;
  createdAt?: string;
  updatedAt?: string;
  services?: DoctorServiceSummary[];
}

/** `ALL` is the UI-only "no filter" value; it is never sent to the API. */
export type DoctorStatusFilter = 'ALL' | ProfileStatus;

export interface ListDoctorsParams {
  status?: DoctorStatusFilter;
  search?: string;
  serviceId?: string;
  signal?: AbortSignal;
}

export interface CreateDoctorInput {
  email: string;
  password: string;
  fullName: string;
  specialization: string;
  professionalLicenseNumber?: string;
}

export interface UpdateDoctorInput {
  fullName: string;
  specialization: string;
  /** `null` clears the stored value; omitting it leaves it unchanged. */
  professionalLicenseNumber: string | null;
}
