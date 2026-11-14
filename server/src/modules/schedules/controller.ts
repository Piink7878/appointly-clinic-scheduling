// ==============================================================================
// Appointly Server — Schedule Controller Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 6 & Sprint 1 Contracts (F-006, F-007)
// Exposes HTTP endpoints for doctor self-schedule management and admin schedule governance.
// ==============================================================================

import { type Request, type Response, type NextFunction } from 'express';
import { scheduleService } from './service';
import {
  updateScheduleSchema,
  extractShiftsFromInput,
  createExceptionSchema,
} from './validation';
import { AppError } from '../../shared/middleware/errorHandler';

import { sendSuccess } from '../../shared/utils/response';
/**
 * An administrator overriding a doctor's schedule must say why (SDS 6.1 "with audit reason",
 * 7.3). The reason is recorded in the AuditLog, so it is required here — not just in the UI.
 */
function requireOverrideReason(value: unknown): string {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (!reason) {
    throw AppError.badRequest('A reason is required for administrator schedule overrides.', 'VALIDATION_ERROR');
  }
  return reason;
}

export class ScheduleController {
  /**
   * GET /api/v1/doctors/me/schedule
   * Role: DOCTOR
   * Resolves authenticated doctor from req.user.userId and returns weekly shifts and exceptions.
   */
  async getMySchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctor = await scheduleService.getDoctorByUserId(req.user.userId);
      const scheduleData = await scheduleService.getDoctorSchedule(doctor.doctorId);

      sendSuccess(res, scheduleData, 'Doctor schedule retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/doctors/me/schedule
   * Role: DOCTOR
   * Atomically updates weekly shifts for the authenticated doctor with immediate effect (DEC-006).
   * Validates startTime < endTime and non-overlapping shifts on the same day.
   */
  async updateMySchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctor = await scheduleService.getDoctorByUserId(req.user.userId);
      const parsed = updateScheduleSchema.parse(req.body);
      const shifts = extractShiftsFromInput(parsed);

      const updatedSchedules = await scheduleService.updateDoctorSchedule(doctor.doctorId, shifts);

      const result = {
        doctorId: doctor.doctorId,
        schedules: updatedSchedules,
        weeklySchedules: updatedSchedules,
        shifts: updatedSchedules,
      };

      sendSuccess(res, result, 'Doctor schedule updated successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/doctors/me/exceptions
   * Role: DOCTOR
   * Retrieves exceptions belonging to authenticated doctor.
   */
  async getMyExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctor = await scheduleService.getDoctorByUserId(req.user.userId);
      const exceptions = await scheduleService.getDoctorExceptions(doctor.doctorId);

      sendSuccess(res, exceptions, 'Schedule exceptions retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/doctors/me/exceptions
   * Role: DOCTOR
   * Records a schedule exception (holiday, break, or unavailable block) for authenticated doctor.
   */
  async createMyException(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctor = await scheduleService.getDoctorByUserId(req.user.userId);
      const validatedInput = createExceptionSchema.parse(req.body);
      const exception = await scheduleService.createException(
        doctor.doctorId,
        validatedInput,
        req.user.userId,
        false
      );

      sendSuccess(res, exception, 'Schedule exception created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/doctors/me/exceptions/:exceptionId
   * Role: DOCTOR
   * Deletes an exception owned by the authenticated doctor (404 if owned by another doctor).
   */
  async deleteMyException(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctor = await scheduleService.getDoctorByUserId(req.user.userId);
      const { exceptionId } = req.params;
      const result = await scheduleService.deleteException(
        doctor.doctorId,
        exceptionId,
        req.user.userId,
        false
      );

      sendSuccess(res, result, 'Schedule exception deleted successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/doctors/:doctorId/schedule
   * Role: ADMIN (or PATIENT/DOCTOR for availability inspection)
   */
  async getDoctorScheduleAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorId = req.params.doctorId || req.params.id;
      const scheduleData = await scheduleService.getDoctorSchedule(doctorId);

      sendSuccess(res, scheduleData, 'Doctor schedule retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/doctors/:doctorId/schedule
   * Role: ADMIN
   * Administrative override of a doctor's weekly working shifts with mandatory AuditLog record.
   */
  async updateDoctorScheduleAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctorId = req.params.doctorId || req.params.id;
      const parsed = updateScheduleSchema.parse(req.body);
      const shifts = extractShiftsFromInput(parsed);
      const reason = requireOverrideReason(req.body?.reason ?? req.body?.overrideReason);

      const updatedSchedules = await scheduleService.updateDoctorSchedule(
        doctorId,
        shifts,
        req.user.userId,
        reason
      );

      const result = {
        doctorId,
        schedules: updatedSchedules,
        weeklySchedules: updatedSchedules,
        shifts: updatedSchedules,
      };

      sendSuccess(res, result, 'Doctor schedule updated successfully by administrator.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/doctors/:doctorId/exceptions
   * Role: ADMIN
   */
  async getDoctorExceptionsAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorId = req.params.doctorId || req.params.id;
      const exceptions = await scheduleService.getDoctorExceptions(doctorId);

      sendSuccess(res, exceptions, 'Doctor exceptions retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/doctors/:doctorId/exceptions
   * Role: ADMIN
   * Creates an exception or override for a doctor with recorded reason in AuditLog.
   */
  async createDoctorExceptionAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctorId = req.params.doctorId || req.params.id;
      const validatedInput = createExceptionSchema.parse(req.body);
      requireOverrideReason(validatedInput.reason);
      const exception = await scheduleService.createException(
        doctorId,
        validatedInput,
        req.user.userId,
        true
      );

      sendSuccess(res, exception, 'Doctor schedule exception created successfully by administrator.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/doctors/:doctorId/exceptions/:exceptionId
   * Role: ADMIN
   */
  async deleteDoctorExceptionAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const doctorId = req.params.doctorId || req.params.id;
      const { exceptionId } = req.params;
      const result = await scheduleService.deleteException(
        doctorId,
        exceptionId,
        req.user.userId,
        true
      );

      sendSuccess(res, result, 'Doctor schedule exception deleted successfully by administrator.', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const scheduleController = new ScheduleController();
export default scheduleController;

