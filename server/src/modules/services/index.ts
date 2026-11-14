// ==============================================================================
// Appointly Server — Services Module Index & Route Configuration
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6 & Sprint 1 Contracts (F-004)
// Mounts /api/v1/services routes with RBAC guards.
// ==============================================================================

import { Router } from 'express';
import { authGuard, roleGuard } from '../../shared/middleware';
import { serviceController } from './controller';

export const servicesRouter = Router();

/**
 * GET /api/v1/services
 * Accessible by: PATIENT, DOCTOR, ADMIN
 * Filters:
 *   - PATIENT / DOCTOR: strictly ACTIVE services (FR-016, FR-018, BR-004)
 *   - ADMIN: full list with ?status=ACTIVE|INACTIVE and ?search=
 */
servicesRouter.get(
  '/',
  authGuard,
  roleGuard('PATIENT', 'DOCTOR', 'ADMIN'),
  (req, res, next) => serviceController.getServices(req, res, next)
);

/**
 * GET /api/v1/services/:serviceId
 * Accessible by: PATIENT, DOCTOR, ADMIN
 */
servicesRouter.get(
  '/:serviceId',
  authGuard,
  roleGuard('PATIENT', 'DOCTOR', 'ADMIN'),
  (req, res, next) => serviceController.getServiceById(req, res, next)
);

export { serviceController } from './controller';
export { serviceService } from './service';
export * from './validation';
