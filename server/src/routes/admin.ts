// ==============================================================================
// Appointly Server — Administrator Route Handler (RBAC Protected)
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6.2 & Sprint 1 Contracts (F-001)
// Enforces authGuard + roleGuard('ADMIN') across all /api/v1/admin/* routes.
// ==============================================================================

import { Router } from 'express';
import { authGuard, roleGuard } from '../shared/middleware';
import { sendSuccess } from '../shared/utils/response';
import { patientController } from '../modules/patients';

export const adminRouter = Router();

// All /api/v1/admin routes require authenticated ADMIN role
adminRouter.use(authGuard, roleGuard('ADMIN'));

/**
 * GET /api/v1/admin/patients
 * Reference: System-Level SDS Section 5.2 & Sprint 1 Contracts (F-002)
 * Searches and lists patient accounts with pagination metadata.
 */
adminRouter.get('/patients', authGuard, roleGuard('ADMIN'), (req, res, next) =>
  patientController.getPatients(req, res, next)
);

adminRouter.post('/services', (_req, res) => {
  sendSuccess(res, { service: {} }, 'Admin create service placeholder', 201);
});

adminRouter.patch('/settings', (_req, res) => {
  sendSuccess(res, { updated: true }, 'Admin settings update placeholder');
});

adminRouter.get('/dashboard', (_req, res) => {
  sendSuccess(res, { status: 'admin_dashboard_ready' }, 'Admin dashboard placeholder');
});

export default adminRouter;

