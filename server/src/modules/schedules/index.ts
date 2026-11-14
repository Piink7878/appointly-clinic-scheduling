// ==============================================================================
// Appointly Server — Schedules Module Exports
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 6 & Sprint 1 Contracts (F-006, F-007)
// The schedule endpoints are mounted by their owners — there is deliberately no
// /api/v1/schedules router, so a schedule has exactly one URL per audience:
//   - DOCTOR: /api/v1/doctors/me/schedule and /exceptions        (modules/doctors/index.ts)
//   - ADMIN:  /api/v1/admin/doctors/:doctorId/schedule and /exceptions   (routes/admin.ts)
// ==============================================================================

export * from './scheduleValidator';
export * from './validation';
export * from './service';
export * from './controller';
