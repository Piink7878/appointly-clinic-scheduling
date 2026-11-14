// ==============================================================================
// Appointly Server — Doctor Controller
// ==============================================================================
// Reference: System-Level SDS Section 3.2C, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-003, F-005)
// Handles endpoints for doctor listing, creation, updates, and status toggles.
// ==============================================================================

import { type Request, type Response, type NextFunction } from 'express';
import { doctorService } from './service';
import {
  createDoctorSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
  getDoctorsQuerySchema,
  assignServiceSchema,
} from './validation';
import { AppError } from '../../shared/middleware/errorHandler';

import { sendSuccess } from '../../shared/utils/response';
export class DoctorController {
  /**
   * GET /api/v1/doctors
   * Requires: authGuard + roleGuard('PATIENT', 'DOCTOR', 'ADMIN')
   * - PATIENT / DOCTOR: strictly returns only ACTIVE doctors with ACTIVE accounts (FR-012, FR-013, BR-003).
   * - ADMIN: returns all doctors with query filtering (?status=, ?search=, ?serviceId=) and service details.
   */
  async getDoctors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = getDoctorsQuerySchema.parse(req.query);
      const userRole = req.user?.role || 'PATIENT';
      const doctors = await doctorService.getDoctors(userRole, query);

      sendSuccess(res, doctors, 'Doctors retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/doctors/:doctorId
   * Requires: authGuard + roleGuard('PATIENT', 'DOCTOR', 'ADMIN')
   */
  async getDoctorById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorId = req.params.doctorId;
      const userRole = req.user?.role || 'PATIENT';
      const doctor = await doctorService.getDoctorById(doctorId, userRole);

      sendSuccess(res, doctor, 'Doctor profile retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/doctors
   * Requires: authGuard + roleGuard('ADMIN')
   * Accepts: { email, password, fullName, specialization, professionalLicenseNumber? }
   * Atomically provisions User and Doctor profile in a single transaction.
   */
  async createDoctor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const validatedInput = createDoctorSchema.parse(req.body);
      const createdDoctor = await doctorService.createDoctor(req.user.userId, validatedInput);

      sendSuccess(res, createdDoctor, 'Doctor profile created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/doctors/:doctorId
   * Requires: authGuard + roleGuard('ADMIN')
   * Updates fullName, specialization, and professionalLicenseNumber.
   */
  async updateDoctor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctorId = req.params.doctorId;
      const validatedInput = updateDoctorSchema.parse(req.body);
      const updatedDoctor = await doctorService.updateDoctor(req.user.userId, doctorId, validatedInput);

      sendSuccess(res, updatedDoctor, 'Doctor profile updated successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/doctors/:doctorId/status
   * Requires: authGuard + roleGuard('ADMIN')
   * Accepts: { profileStatus: 'ACTIVE' | 'INACTIVE' }
   * Updates Doctor.profile_status, synchronizes User.account_status, records AuditLog.
   */
  async updateDoctorStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctorId = req.params.doctorId;
      const rawStatus = req.body?.profileStatus ?? req.body?.status;
      const validated = updateDoctorStatusSchema.parse({ profileStatus: rawStatus });
      const updatedDoctor = await doctorService.updateDoctorStatus(
        req.user.userId,
        doctorId,
        validated.profileStatus
      );

      sendSuccess(res, updatedDoctor, 'Doctor status updated successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/doctors/:doctorId/services
   * Requires: authGuard + roleGuard('ADMIN')
   * Accepts: { serviceId } or { serviceIds: [] }
   * - single form: responds 201 with the created assignment (and its service)
   * - batch form:  responds 201 with { doctorId, assignments: [...] } (all-or-nothing)
   */
  async assignService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctorId = req.params.doctorId;
      const validated = assignServiceSchema.parse(req.body);
      const assignments = await doctorService.assignServices(req.user.userId, doctorId, validated.serviceIds);

      if (validated.batch) {
        const result = { doctorId, assignments, total: assignments.length };
        sendSuccess(res, result, 'Medical services assigned to doctor successfully.', 201);
        return;
      }

      const result = assignments[0];
      sendSuccess(res, result, 'Medical service assigned to doctor successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/doctors/:doctorId/services/:serviceId
   * Requires: authGuard + roleGuard('ADMIN')
   */
  async unassignService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const { doctorId, serviceId } = req.params;
      const result = await doctorService.unassignService(req.user.userId, doctorId, serviceId);

      sendSuccess(res, result, 'Medical service unassigned from doctor successfully.', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const doctorController = new DoctorController();

