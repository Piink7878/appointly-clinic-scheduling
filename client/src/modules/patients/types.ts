// ==============================================================================
// Appointly Client — Patient Module Types
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.2 (F-002) & SDS Section 3.2B
// Mirrors the camelCase DTOs returned by the backend patient module.
// No medical/EMR fields exist in this module by design (data minimisation).
// ==============================================================================

export interface PatientProfile {
  patientId: string;
  userId?: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  /** ISO datetime of the stored DATE (UTC midnight), or null when not provided. */
  dateOfBirth: string | null;
}

export interface UpdatePatientProfileInput {
  fullName: string;
  phoneNumber: string;
  /** "YYYY-MM-DD", or null to clear. Never an empty string (backend rejects it). */
  dateOfBirth: string | null;
}

export interface PatientDirectoryItem {
  patientId: string;
  userId?: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  dateOfBirth: string | null;
  accountStatus: string;
}

export interface PatientListResult {
  items: PatientDirectoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ListPatientsParams {
  search?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}
