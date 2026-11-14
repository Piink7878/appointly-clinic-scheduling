// ==============================================================================
// Appointly Server — Patient Controller
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6, 7.2 & Sprint 1 Contracts (F-002)
// Handles endpoints for patient profile view/update and admin patient directory.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { patientService } from './service';
import { updatePatientSchema, getPatientsQuerySchema } from './validation';
import { AppError } from '../../shared/middleware/errorHandler';

import { sendSuccess } from '../../shared/utils/response';
export class PatientController {
  /**
   * GET /api/v1/patients/me
   * Requires: authGuard + roleGuard('PATIENT')
   * Strictly retrieves profile for req.user.userId.
   * Never accepts patientId or userId from query or body.
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const profile = await patientService.getPatientProfileByUserId(req.user.userId);

      sendSuccess(res, profile, 'Patient profile retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/patients/me
   * Requires: authGuard + roleGuard('PATIENT')
   * Accepts { fullName, phoneNumber, dateOfBirth? }
   * Strictly updates only the record belonging to req.user.userId.
   */
  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      // Strictly take only allowed fields from request body, ignoring any userId or patientId override
      const validatedInput = updatePatientSchema.parse({
        fullName: req.body?.fullName,
        phoneNumber: req.body?.phoneNumber,
        dateOfBirth: req.body?.dateOfBirth,
      });

      const updated = await patientService.updatePatientProfileByUserId(
        req.user.userId,
        validatedInput
      );

      sendSuccess(res, updated, 'Patient profile updated successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/patients
   * Requires: authGuard + roleGuard('ADMIN')
   * Supports query parameters ?search=&page=1&limit=20
   */
  async getPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = getPatientsQuerySchema.parse(req.query);
      const result = await patientService.getPatients(query);

      sendSuccess(
        res,
        { items: result.items, total: result.total, page: result.page, limit: result.limit },
        'Patient directory retrieved successfully.'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const patientController = new PatientController();

