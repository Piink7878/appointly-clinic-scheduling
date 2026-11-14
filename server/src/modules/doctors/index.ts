// ==============================================================================
// Appointly Server — Doctors Module Index & Route Configuration
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6 & Sprint 1 Contracts (F-003, F-005)
// Mounts /api/v1/doctors routes with RBAC guards.
// ==============================================================================

import { Router } from 'express';
import { authGuard, roleGuard } from '../../shared/middleware';
import { doctorController } from './controller';
import { scheduleController } from '../schedules';

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
 * Doctor Self-Schedule Management Routes (F-006)
 * Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 6 & Sprint 1 Contracts (F-006)
 * Mounted before /:doctorId to ensure /me/schedule and /me/exceptions are matched first.
 */
doctorsRouter.get(
  '/me/schedule',
  authGuard,
  roleGuard('DOCTOR'),
  (req, res, next) => scheduleController.getMySchedule(req, res, next)
);

doctorsRouter.put(
  '/me/schedule',
  authGuard,
  roleGuard('DOCTOR'),
  (req, res, next) => scheduleController.updateMySchedule(req, res, next)
);

doctorsRouter.get(
  '/me/exceptions',
  authGuard,
  roleGuard('DOCTOR'),
  (req, res, next) => scheduleController.getMyExceptions(req, res, next)
);

doctorsRouter.post(
  '/me/exceptions',
  authGuard,
  roleGuard('DOCTOR'),
  (req, res, next) => scheduleController.createMyException(req, res, next)
);

doctorsRouter.delete(
  '/me/exceptions/:exceptionId',
  authGuard,
  roleGuard('DOCTOR'),
  (req, res, next) => scheduleController.deleteMyException(req, res, next)
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
