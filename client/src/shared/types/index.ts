// ==============================================================================
// Appointly Client — Shared Domain Types & DTOs
// ==============================================================================
// Reference: System-Level SDS Section 2.3 & 3.2
// ==============================================================================

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export interface UserProfile {
  userId: string;
  email: string;
  role: UserRole;
  accountStatus?: AccountStatus | string;
  fullName?: string;
  profileId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  // Convenience properties returned by auth endpoints
  userId?: string;
  email?: string;
  role?: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
