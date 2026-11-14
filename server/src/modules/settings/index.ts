// ==============================================================================
// Appointly Server — Clinic Settings Module Router & Exports
// ==============================================================================
// Reference: System-Level SDS Section 3.2K, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-007)
// Mounts public clinic settings endpoints and admin settings endpoints.
// ==============================================================================

import { Router } from 'express';
import { settingsController } from './controller';

export const settingsRouter = Router();

// Public endpoint: GET /api/v1/settings/public
settingsRouter.get('/public', (req, res, next) =>
  settingsController.getPublicSettings(req, res, next)
);

export * from './validation';
export * from './service';
export * from './controller';
export default settingsRouter;
