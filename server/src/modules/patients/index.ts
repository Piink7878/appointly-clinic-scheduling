// ==============================================================================
// Appointly Server — Patient Module Router & Exports
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6.2 & Sprint 1 Contracts (F-002)
// Mounts patient profile routes under /api/v1/patients
// ==============================================================================

import { Router } from 'express';
import { patientController } from './controller';
import { authGuard, roleGuard } from '../../shared/middleware';

export const patientsRouter = Router();

/**
 * GET /api/v1/patients/me
 * Retrieves authenticated patient's profile.
 * Multi-layer enforcement: authGuard (Gate 1) + roleGuard('PATIENT') (Gate 2)
 */
patientsRouter.get('/me', authGuard, roleGuard('PATIENT'), (req, res, next) =>
  patientController.getMe(req, res, next)
);

/**
 * PUT /api/v1/patients/me
 * Updates authenticated patient's profile.
 * Multi-layer enforcement: authGuard (Gate 1) + roleGuard('PATIENT') (Gate 2)
 */
patientsRouter.put('/me', authGuard, roleGuard('PATIENT'), (req, res, next) =>
  patientController.updateMe(req, res, next)
);

export * from './controller';
export * from './service';
export * from './validation';
export default patientsRouter;
