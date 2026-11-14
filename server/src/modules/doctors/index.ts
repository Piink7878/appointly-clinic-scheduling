// ==============================================================================
// Appointly Server — Doctors Module Index & Route Configuration
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6 & Sprint 1 Contracts (F-003, F-005)
// Mounts /api/v1/doctors routes with RBAC guards.
// ==============================================================================

import { Router } from 'express';
import { authGuard, roleGuard } from '../../shared/middleware';
import { doctorController } from './controller';

export const doctorsRouter = Router();

/**
 * GET /api/v1/doctors
 * Accessible by: PATIENT, DOCTOR, ADMIN
 * Filters:
 *   - PATIENT / DOCTOR: strictly ACTIVE doctors with ACTIVE accounts
 *   - ADMIN: all doctors with ?status=, ?search=, ?serviceId= filters
 */
doctorsRouter.get(
  '/',
  authGuard,
  roleGuard('PATIENT', 'DOCTOR', 'ADMIN'),
  (req, res, next) => doctorController.getDoctors(req, res, next)
);

/**
 * GET /api/v1/doctors/:doctorId
 * Accessible by: PATIENT, DOCTOR, ADMIN
 */
doctorsRouter.get(
  '/:doctorId',
  authGuard,
  roleGuard('PATIENT', 'DOCTOR', 'ADMIN'),
  (req, res, next) => doctorController.getDoctorById(req, res, next)
);

export { doctorController } from './controller';
export { doctorService } from './service';
export * from './validation';
