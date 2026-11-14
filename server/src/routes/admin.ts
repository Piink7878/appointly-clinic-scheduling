// ==============================================================================
// Appointly Server — Administrator Route Handler (RBAC Protected)
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6.2 & Sprint 1 Contracts (F-001)
// Enforces authGuard + roleGuard('ADMIN') across all /api/v1/admin/* routes.
// ==============================================================================

import { Router } from 'express';
import { authGuard, roleGuard } from '../shared/middleware';
import { sendSuccess } from '../shared/utils/response';

export const adminRouter = Router();

// All /api/v1/admin routes require authenticated ADMIN role
adminRouter.use(authGuard, roleGuard('ADMIN'));

/**
 * Dummy placeholder endpoints for Sprint 1 RBAC cross-role permission testing.
 * (Actual business logic implemented in respective domain modules).
 */
adminRouter.get('/patients', (_req, res) => {
  sendSuccess(res, { patients: [] }, 'Admin patient directory placeholder');
});

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

