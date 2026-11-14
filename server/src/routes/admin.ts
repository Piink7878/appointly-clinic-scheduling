// ==============================================================================
// Appointly Server — Administrator Route Handler (RBAC Protected)
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6.2 & Sprint 1 Contracts (F-001, F-003, F-005)
// Enforces authGuard + roleGuard('ADMIN') across all /api/v1/admin/* routes.
// ==============================================================================

import { Router } from 'express';
import { authGuard, roleGuard } from '../shared/middleware';
import { sendSuccess } from '../shared/utils/response';
import { patientController } from '../modules/patients';
import { doctorController } from '../modules/doctors';
import { serviceController } from '../modules/services';

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

/**
 * Doctor Management Routes (F-003, F-005)
 * Reference: System-Level SDS Section 3.2C, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-003, F-005)
 */
adminRouter.get('/doctors', (req, res, next) => doctorController.getDoctors(req, res, next));
adminRouter.post('/doctors', (req, res, next) => doctorController.createDoctor(req, res, next));
adminRouter.put('/doctors/:doctorId', (req, res, next) => doctorController.updateDoctor(req, res, next));
adminRouter.patch('/doctors/:doctorId/status', (req, res, next) =>
  doctorController.updateDoctorStatus(req, res, next)
);
adminRouter.post('/doctors/:doctorId/services', (req, res, next) =>
  doctorController.assignService(req, res, next)
);
adminRouter.delete('/doctors/:doctorId/services/:serviceId', (req, res, next) =>
  doctorController.unassignService(req, res, next)
);

/**
 * Medical Service Catalog Management Routes (F-004)
 * Reference: System-Level SDS Section 3.2D, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-004)
 */
adminRouter.get('/services', (req, res, next) => serviceController.getServices(req, res, next));
adminRouter.get('/services/:serviceId', (req, res, next) => serviceController.getServiceById(req, res, next));
adminRouter.post('/services', (req, res, next) => serviceController.createService(req, res, next));
adminRouter.put('/services/:serviceId', (req, res, next) => serviceController.updateService(req, res, next));
adminRouter.patch('/services/:serviceId/status', (req, res, next) =>
  serviceController.updateServiceStatus(req, res, next)
);

adminRouter.patch('/settings', (_req, res) => {
  sendSuccess(res, { updated: true }, 'Admin settings update placeholder');
});

adminRouter.get('/dashboard', (_req, res) => {
  sendSuccess(res, { status: 'admin_dashboard_ready' }, 'Admin dashboard placeholder');
});

export default adminRouter;
