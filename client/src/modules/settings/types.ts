// ==============================================================================
// Appointly Client — Clinic Settings Types
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.7 (F-007)
// ==============================================================================

export interface ClinicSettings {
  clinicName: string;
  /** IANA timezone identifier, e.g. "Asia/Bangkok". */
  timezone: string;
  /** Appointment start times are generated every N minutes (5, 10, 15, 20, 30 or 60). */
  fixedStartIntervalMinutes: number;
  /** Patients may cancel / reschedule only more than N hours before the start (BR-022, BR-023). */
  cancellationCutoffHours: number;
}

export type UpdateSettingsInput = ClinicSettings;
