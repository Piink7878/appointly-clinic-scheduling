// ==============================================================================
// Appointly Server — Schedules Module Router & Exports
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 6 & Sprint 1 Contracts (F-006, F-007)
// Mounts doctor schedule and exception endpoints under /api/v1/schedules
// ==============================================================================

import { Router } from 'express';
import { scheduleController } from './controller';
import { authGuard, roleGuard } from '../../shared/middleware';

export const schedulesRouter = Router();

// ==============================================================================
// Doctor Self-Schedule Endpoints (/api/v1/schedules/me)
// ==============================================================================
schedulesRouter.get('/me/schedule', authGuard, roleGuard('DOCTOR'), (req, res, next) =>
  scheduleController.getMySchedule(req, res, next)
);

schedulesRouter.put('/me/schedule', authGuard, roleGuard('DOCTOR'), (req, res, next) =>
  scheduleController.updateMySchedule(req, res, next)
);

schedulesRouter.get('/me/exceptions', authGuard, roleGuard('DOCTOR'), (req, res, next) =>
  scheduleController.getMyExceptions(req, res, next)
);

schedulesRouter.post('/me/exceptions', authGuard, roleGuard('DOCTOR'), (req, res, next) =>
  scheduleController.createMyException(req, res, next)
);

schedulesRouter.delete(
  '/me/exceptions/:exceptionId',
  authGuard,
  roleGuard('DOCTOR'),
  (req, res, next) => scheduleController.deleteMyException(req, res, next)
);

// Aliases for /api/v1/schedules/me directly
schedulesRouter.get('/me', authGuard, roleGuard('DOCTOR'), (req, res, next) =>
  scheduleController.getMySchedule(req, res, next)
);

schedulesRouter.put('/me', authGuard, roleGuard('DOCTOR'), (req, res, next) =>
  scheduleController.updateMySchedule(req, res, next)
);

// ==============================================================================
// Doctor-Specific Schedule Endpoints (ADMIN only — a schedule includes private
// exception reasons, so patients/doctors may only read their own via /me)
// ==============================================================================
schedulesRouter.get(
  '/doctors/:doctorId',
  authGuard,
  roleGuard('ADMIN'),
  (req, res, next) => scheduleController.getDoctorScheduleAdmin(req, res, next)
);

schedulesRouter.put(
  '/doctors/:doctorId',
  authGuard,
  roleGuard('ADMIN'),
  (req, res, next) => scheduleController.updateDoctorScheduleAdmin(req, res, next)
);

schedulesRouter.post(
  '/doctors/:doctorId/exceptions',
  authGuard,
  roleGuard('ADMIN'),
  (req, res, next) => scheduleController.createDoctorExceptionAdmin(req, res, next)
);

schedulesRouter.delete(
  '/doctors/:doctorId/exceptions/:exceptionId',
  authGuard,
  roleGuard('ADMIN'),
  (req, res, next) => scheduleController.deleteDoctorExceptionAdmin(req, res, next)
);

// Parametric route aliases for /:doctorId
schedulesRouter.get(
  '/:doctorId',
  authGuard,
  roleGuard('ADMIN'),
  (req, res, next) => scheduleController.getDoctorScheduleAdmin(req, res, next)
);

schedulesRouter.put(
  '/:doctorId',
  authGuard,
  roleGuard('ADMIN'),
  (req, res, next) => scheduleController.updateDoctorScheduleAdmin(req, res, next)
);

export * from './scheduleValidator';
export * from './validation';
export * from './service';
export * from './controller';
export default schedulesRouter;
