// ==============================================================================
// Appointly Server — Schedule Service Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 6 & Sprint 1 Contracts (F-006, F-007)
// Manages weekly working shifts, split shifts, date-specific exceptions, and audit logging.
// ==============================================================================

import { ExceptionType } from '@prisma/client';
import { prisma } from '../../shared/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { scheduleValidator, ShiftInput, ExceptionInput } from './scheduleValidator';
import { CreateExceptionInput } from './validation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  if (typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

export class ScheduleService {
  /**
   * Resolves Doctor record associated with an authenticated User ID.
   */
  async getDoctorByUserId(userId: string) {
    if (!isValidUuid(userId)) {
      throw AppError.notFound('Doctor profile not found for user.', 'DOCTOR_NOT_FOUND');
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!doctor) {
      throw AppError.notFound('Doctor profile not found for authenticated user.', 'DOCTOR_NOT_FOUND');
    }

    return doctor;
  }

  /**
   * Resolves Doctor record by doctorId.
   */
  async getDoctorById(doctorId: string) {
    if (!isValidUuid(doctorId)) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId },
      include: { user: true },
    });

    if (!doctor) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    return doctor;
  }

  /**
   * Retrieves complete schedule dataset for a doctor:
   *   - weeklySchedules: recurring weekly shifts
   *   - exceptions: date-specific schedule exceptions
   */
  async getDoctorSchedule(doctorId: string) {
    await this.getDoctorById(doctorId);

    const weeklySchedules = await prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const exceptions = await prisma.scheduleException.findMany({
      where: { doctorId },
      orderBy: [{ exceptionDate: 'asc' }, { startTime: 'asc' }],
    });

    return {
      doctorId,
      weeklySchedules,
      shifts: weeklySchedules,
      exceptions,
    };
  }

  /**
   * Atomically updates a doctor's weekly recurring shifts.
   * Enforces domain validation rules (startTime < endTime, non-overlapping windows on the same day).
   * If updated by an Admin, records an AuditLog entry (ADMIN_SCHEDULE_UPDATE).
   */
  async updateDoctorSchedule(
    doctorId: string,
    shifts: ShiftInput[],
    authorUserId?: string,
    adminOverrideReason?: string
  ) {
    // 1. Verify doctor existence
    await this.getDoctorById(doctorId);

    // 2. Domain Validation: check time formats, startTime < endTime, and no overlaps on same dayOfWeek
    scheduleValidator.validateShifts(shifts);

    // 3. Atomic replacement inside a database transaction
    const updatedSchedules = await prisma.$transaction(async (tx) => {
      // Clear existing shifts for the doctor
      await tx.doctorSchedule.deleteMany({
        where: { doctorId },
      });

      // Insert new shifts if any provided
      if (shifts.length > 0) {
        await tx.doctorSchedule.createMany({
          data: shifts.map((s) => ({
            doctorId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime.trim(),
            endTime: s.endTime.trim(),
            isActive: s.isActive !== undefined ? s.isActive : true,
          })),
        });
      }

      // Record AuditLog if action was performed by an Administrator
      if (authorUserId && adminOverrideReason) {
        await tx.auditLog.create({
          data: {
            userId: authorUserId,
            actionType: 'ADMIN_SCHEDULE_UPDATE',
            entityType: 'DoctorSchedule',
            entityId: doctorId,
            details: {
              reason: adminOverrideReason,
              shiftsCount: shifts.length,
            },
          },
        });
      }

      // Return newly created shifts
      return tx.doctorSchedule.findMany({
        where: { doctorId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });

    return updatedSchedules;
  }

  /**
   * Retrieves date-specific exceptions for a doctor.
   */
  async getDoctorExceptions(doctorId: string) {
    await this.getDoctorById(doctorId);

    return prisma.scheduleException.findMany({
      where: { doctorId },
      orderBy: [{ exceptionDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Creates a schedule exception for a doctor.
   * Full-day exceptions (e.g. HOLIDAY with startTime = null, endTime = null) are permitted.
   * Partial-day exceptions must satisfy startTime < endTime.
   * If created by an Admin, records an AuditLog entry (ADMIN_SCHEDULE_EXCEPTION_CREATED).
   */
  async createException(
    doctorId: string,
    input: CreateExceptionInput,
    authorUserId: string,
    isAdmin = false
  ) {
    // 1. Verify doctor existence
    await this.getDoctorById(doctorId);

    // 2. Validate exception window and types
    scheduleValidator.validateException(input as ExceptionInput);

    // 3. Parse date
    const dateStr =
      input.exceptionDate instanceof Date
        ? input.exceptionDate.toISOString().slice(0, 10)
        : String(input.exceptionDate);

    const parsedDate = new Date(
      dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00.000Z`
    );

    if (isNaN(parsedDate.getTime())) {
      throw AppError.badRequest('Invalid exceptionDate format.', 'INVALID_EXCEPTION_DATE');
    }

    // 4. Create ScheduleException
    const createdException = await prisma.scheduleException.create({
      data: {
        doctorId,
        exceptionDate: parsedDate,
        startTime: input.startTime ? input.startTime.trim() : null,
        endTime: input.endTime ? input.endTime.trim() : null,
        exceptionType: input.exceptionType as ExceptionType,
        reason: input.reason ? input.reason.trim() : null,
        createdBy: authorUserId,
      },
    });

    // 5. Audit logging for administrative exceptions
    if (isAdmin) {
      await prisma.auditLog.create({
        data: {
          userId: authorUserId,
          actionType: 'ADMIN_SCHEDULE_EXCEPTION_CREATED',
          entityType: 'ScheduleException',
          entityId: createdException.exceptionId,
          details: {
            doctorId,
            exceptionDate: dateStr,
            exceptionType: input.exceptionType,
            reason: input.reason || null,
          },
        },
      });
    }

    return createdException;
  }

  /**
   * Deletes a schedule exception.
   * Enforces ownership: doctors can only delete exceptions belonging to themselves.
   * Administrators can delete any doctor's exception and write an AuditLog record.
   */
  async deleteException(
    doctorId: string,
    exceptionId: string,
    authorUserId?: string,
    isAdmin = false
  ) {
    if (!isValidUuid(exceptionId)) {
      throw AppError.notFound('Schedule exception not found.', 'EXCEPTION_NOT_FOUND');
    }

    const exception = await prisma.scheduleException.findUnique({
      where: { exceptionId },
    });

    if (!exception) {
      throw AppError.notFound('Schedule exception not found.', 'EXCEPTION_NOT_FOUND');
    }

    // Anti-enumeration / ownership guard (NFR-004):
    // Non-admin doctors attempting to delete another doctor's exception receive 404 Not Found
    if (!isAdmin && exception.doctorId !== doctorId) {
      throw AppError.notFound('Schedule exception not found.', 'EXCEPTION_NOT_FOUND');
    }

    await prisma.scheduleException.delete({
      where: { exceptionId },
    });

    if (isAdmin && authorUserId) {
      await prisma.auditLog.create({
        data: {
          userId: authorUserId,
          actionType: 'ADMIN_SCHEDULE_EXCEPTION_DELETED',
          entityType: 'ScheduleException',
          entityId: exceptionId,
          details: { doctorId: exception.doctorId },
        },
      });
    }

    return {
      deleted: true,
      exceptionId,
    };
  }
}

export const scheduleService = new ScheduleService();
export default scheduleService;

