// ==============================================================================
// Appointly Server — Patient Service Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2B, 5.2, 6, 7.2 & Sprint 1 Contracts (F-002)
// Handles patient profile retrieval, profile updates, and admin patient directory queries.
// Strictly adheres to data minimization: NO medical/EMR records are stored or exposed.
// ==============================================================================

import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { UpdatePatientInput, GetPatientsQueryInput } from './validation';

export class PatientService {
  /**
   * Retrieves profile data from the Patient table referencing strictly userId.
   * Throws 404 Not Found if no patient profile exists for the user.
   */
  async getPatientProfileByUserId(userId: string) {
    const patient = await prisma.patient.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            accountStatus: true,
            role: true,
          },
        },
      },
    });

    if (!patient) {
      throw AppError.notFound('Patient profile not found.', 'PATIENT_NOT_FOUND');
    }

    return {
      patientId: patient.patientId,
      userId: patient.userId,
      email: patient.user.email,
      fullName: patient.fullName,
      phoneNumber: patient.phoneNumber,
      dateOfBirth: patient.dateOfBirth,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt,
    };
  }

  /**
   * Updates only the patient profile belonging to userId.
   * Modifies fullName, phoneNumber, and optional dateOfBirth.
   */
  async updatePatientProfileByUserId(userId: string, input: UpdatePatientInput) {
    const existing = await prisma.patient.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!existing) {
      throw AppError.notFound('Patient profile not found.', 'PATIENT_NOT_FOUND');
    }

    const updateData: {
      fullName: string;
      phoneNumber: string;
      dateOfBirth?: Date | null;
    } = {
      fullName: input.fullName.trim(),
      phoneNumber: input.phoneNumber.trim(),
    };

    if (input.dateOfBirth !== undefined) {
      updateData.dateOfBirth = input.dateOfBirth;
    }

    const updated = await prisma.patient.update({
      where: { userId },
      data: updateData,
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return {
      patientId: updated.patientId,
      userId: updated.userId,
      email: updated.user.email,
      fullName: updated.fullName,
      phoneNumber: updated.phoneNumber,
      dateOfBirth: updated.dateOfBirth,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Retrieves paginated patient accounts for administrators.
   * Supports case-insensitive searching on fullName, phoneNumber, or email (joined from User).
   */
  async getPatients(params: GetPatientsQueryInput) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const searchTerm = params.search?.trim();

    const where: Prisma.PatientWhereInput = searchTerm
      ? {
          OR: [
            {
              fullName: {
                contains: searchTerm,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              phoneNumber: {
                contains: searchTerm,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              user: {
                email: {
                  contains: searchTerm,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          ],
        }
      : {};

    const [total, patients] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              accountStatus: true,
            },
          },
        },
      }),
    ]);

    const items = patients.map((p) => ({
      patientId: p.patientId,
      userId: p.userId,
      email: p.user.email,
      fullName: p.fullName,
      phoneNumber: p.phoneNumber,
      dateOfBirth: p.dateOfBirth,
      accountStatus: p.user.accountStatus,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }
}

export const patientService = new PatientService();

