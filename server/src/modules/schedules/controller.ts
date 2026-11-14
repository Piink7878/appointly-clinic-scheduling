// ==============================================================================
// Appointly Server — Schedule Controller Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 6 & Sprint 1 Contracts (F-006, F-007)
// Exposes HTTP endpoints for doctor self-schedule management and admin schedule governance.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { scheduleService } from './service';
import {
  updateScheduleSchema,
  extractShiftsFromInput,
  createExceptionSchema,
} from './validation';
import { AppError } from '../../shared/middleware/errorHandler';

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

      res.status(200).json({
        success: true,
        data: scheduleData,
        ...scheduleData,
        message: 'Doctor schedule retrieved successfully.',
      });
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

      res.status(200).json({
        success: true,
        data: result,
        ...result,
        message: 'Doctor schedule updated successfully.',
      });
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

      res.status(200).json({
        success: true,
        data: exceptions,
        exceptions,
        total: exceptions.length,
        message: 'Schedule exceptions retrieved successfully.',
      });
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

      res.status(201).json({
        success: true,
        data: exception,
        ...exception,
        message: 'Schedule exception created successfully.',
      });
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

      res.status(200).json({
        success: true,
        data: result,
        ...result,
        message: 'Schedule exception deleted successfully.',
      });
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

      res.status(200).json({
        success: true,
        data: scheduleData,
        ...scheduleData,
        message: 'Doctor schedule retrieved successfully.',
      });
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
      const reason =
        (parsed && typeof parsed === 'object' && ('reason' in parsed || 'overrideReason' in parsed)
          ? (parsed as Record<string, unknown>).reason || (parsed as Record<string, unknown>).overrideReason
          : undefined) ||
        req.body?.reason ||
        req.body?.overrideReason ||
        'ADMIN_SCHEDULE_UPDATE';

      const updatedSchedules = await scheduleService.updateDoctorSchedule(
        doctorId,
        shifts,
        req.user.userId,
        String(reason)
      );

      const result = {
        doctorId,
        schedules: updatedSchedules,
        weeklySchedules: updatedSchedules,
        shifts: updatedSchedules,
      };

      res.status(200).json({
        success: true,
        data: result,
        ...result,
        message: 'Doctor schedule updated successfully by administrator.',
      });
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

      res.status(200).json({
        success: true,
        data: exceptions,
        exceptions,
        total: exceptions.length,
        message: 'Doctor exceptions retrieved successfully.',
      });
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
      const exception = await scheduleService.createException(
        doctorId,
        validatedInput,
        req.user.userId,
        true
      );

      res.status(201).json({
        success: true,
        data: exception,
        ...exception,
        message: 'Doctor schedule exception created successfully by administrator.',
      });
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

      res.status(200).json({
        success: true,
        data: result,
        ...result,
        message: 'Doctor schedule exception deleted successfully by administrator.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const scheduleController = new ScheduleController();
export default scheduleController;

