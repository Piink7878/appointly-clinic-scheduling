// ==============================================================================
// Appointly Server — Schedule Service Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2F, 3.2G, 5.2, 6 & Sprint 1 Contracts (F-006, F-007)
// Manages weekly working shifts, split shifts, date-specific exceptions, and audit logging.
// ==============================================================================

import { Prisma, type ExceptionType } from '@prisma/client';
import { prisma } from '../../shared/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { isValidUuid } from '../../shared/utils/uuid';
import { parseClinicCalendarDate } from '../../shared/utils/timezone';
import {
  scheduleValidator,
  parseTimeToSeconds,
  type ShiftInput,
  type ExceptionInput,
} from './scheduleValidator';
import { type CreateExceptionInput } from './validation';

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

      // Record AuditLog if action was performed by an Administrator (Contract §1.7: ADMIN_SCHEDULE_UPDATE)
      if (authorUserId) {
        await tx.auditLog.create({
          data: {
            userId: authorUserId,
            actionType: 'ADMIN_SCHEDULE_UPDATE',
            entityType: 'DoctorSchedule',
            entityId: doctorId,
            details: {
              reason: adminOverrideReason || 'ADMIN_SCHEDULE_UPDATE',
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

    // 3. Resolve the clinic-local calendar date (stored in a DATE column as that day at 00:00 UTC)
    const dateStr = parseClinicCalendarDate(input.exceptionDate);
    if (!dateStr) {
      throw AppError.badRequest('Invalid exceptionDate: expected a real calendar date (YYYY-MM-DD).', 'INVALID_EXCEPTION_DATE');
    }
    const parsedDate = new Date(`${dateStr}T00:00:00.000Z`);

    // 4. Run conflict check and creation inside a Serializable transaction with retry on P2034
    //    so concurrent requests for the same doctor and date cannot race past the overlap check.
    const MAX_SERIALIZATION_RETRIES = 4;
    let createdException;

    for (let attempt = 0; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
      try {
        createdException = await prisma.$transaction(
          async (tx) => {
            await this.assertNoExceptionConflict(tx, doctorId, parsedDate, dateStr, input);

            const created = await tx.scheduleException.create({
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

            if (isAdmin) {
              await tx.auditLog.create({
                data: {
                  userId: authorUserId,
                  actionType: 'ADMIN_SCHEDULE_EXCEPTION_CREATED',
                  entityType: 'ScheduleException',
                  entityId: created.exceptionId,
                  details: {
                    doctorId,
                    exceptionDate: dateStr,
                    exceptionType: input.exceptionType,
                    reason: input.reason || null,
                  },
                },
              });
            }

            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        break;
      } catch (error) {
        const isSerializationFailure =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!isSerializationFailure || attempt === MAX_SERIALIZATION_RETRIES) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
      }
    }

    return createdException!;
  }

  /**
   * Ensures a prospective schedule exception does not duplicate a full-day exception
   * or overlap an existing exception window on the same date for the doctor.
   */
  private async assertNoExceptionConflict(
    tx: Prisma.TransactionClient,
    doctorId: string,
    parsedDate: Date,
    dateStr: string,
    input: CreateExceptionInput
  ): Promise<void> {
    const existingOnDate = await tx.scheduleException.findMany({
      where: { doctorId, exceptionDate: parsedDate },
    });

    if (existingOnDate.length === 0) {
      return;
    }

    const incomingStart = input.startTime ? input.startTime.trim() : null;
    const incomingEnd = input.endTime ? input.endTime.trim() : null;
    const incomingIsFullDay = !incomingStart && !incomingEnd;
    const hasFullDayConflict = existingOnDate.some(
      (e) => e.startTime === null && e.endTime === null
    );

    if (incomingIsFullDay || hasFullDayConflict) {
      throw AppError.conflict(
        `A schedule exception already exists for ${dateStr}. Remove the existing exception before adding a new one.`,
        'SCHEDULE_EXCEPTION_CONFLICT'
      );
    }

    const inStart = parseTimeToSeconds(incomingStart!);
    const inEnd = parseTimeToSeconds(incomingEnd!);
    const hasTimeOverlap = existingOnDate.some((e) => {
      if (e.startTime === null || e.endTime === null) return true;
      const eStart = parseTimeToSeconds(e.startTime);
      const eEnd = parseTimeToSeconds(e.endTime);
      return inStart < eEnd && eStart < inEnd;
    });

    if (hasTimeOverlap) {
      throw AppError.conflict(
        `The exception window ${incomingStart}–${incomingEnd} on ${dateStr} overlaps an existing exception.`,
        'SCHEDULE_EXCEPTION_CONFLICT'
      );
    }
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

    await prisma.$transaction(async (tx) => {
      await tx.scheduleException.delete({
        where: { exceptionId },
      });

      if (isAdmin && authorUserId) {
        await tx.auditLog.create({
          data: {
            userId: authorUserId,
            actionType: 'ADMIN_SCHEDULE_EXCEPTION_DELETED',
            entityType: 'ScheduleException',
            entityId: exceptionId,
            details: { doctorId: exception.doctorId },
          },
        });
      }
    });

    return {
      deleted: true,
      exceptionId,
    };
  }
}

export const scheduleService = new ScheduleService();
export default scheduleService;

