// ==============================================================================
// Appointly Server — Doctor Service Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2C, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-003, F-005)
// Handles doctor directory queries, atomic account creation, profile updates,
// active status synchronization, and doctor-service assignments.
// ==============================================================================

import { Prisma, Role, AccountStatus, ProfileStatus, ServiceStatus } from '@prisma/client';
import { prisma } from '../../shared/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { hashPassword } from '../../shared/utils/security';
import {
  CreateDoctorInput,
  UpdateDoctorInput,
  GetDoctorsQueryInput,
} from './validation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

export class DoctorService {
  /**
   * Retrieves list of doctors according to requester role and optional query filters.
   * - PATIENT / DOCTOR: strictly returns only doctors with profileStatus === 'ACTIVE'
   *   and User.accountStatus === 'ACTIVE' (FR-012, FR-013, BR-003).
   * - ADMIN: returns all doctors (supporting ?status=ACTIVE|INACTIVE and ?search=)
   *   along with associated service details (DoctorService).
   * - Optional ?serviceId= filter returns only doctors assigned to that active service.
   */
  async getDoctors(userRole: string, query: GetDoctorsQueryInput) {
    const isAdmin = userRole === 'ADMIN';

    // 1. Non-admin roles (PATIENT, DOCTOR) can ONLY view ACTIVE doctors with ACTIVE accounts
    if (!isAdmin) {
      const where: Prisma.DoctorWhereInput = {
        profileStatus: ProfileStatus.ACTIVE,
        user: {
          accountStatus: AccountStatus.ACTIVE,
        },
      };

      if (query.serviceId && query.serviceId.trim() !== '') {
        const trimmedServiceId = query.serviceId.trim();
        if (!isValidUuid(trimmedServiceId)) {
          return [];
        }
        where.doctorServices = {
          some: {
            serviceId: trimmedServiceId,
            service: {
              serviceStatus: ServiceStatus.ACTIVE,
            },
          },
        };
      }

      if (query.search && query.search.trim() !== '') {
        const term = query.search.trim();
        where.OR = [
          { fullName: { contains: term, mode: 'insensitive' } },
          { specialization: { contains: term, mode: 'insensitive' } },
        ];
      }

      const doctors = await prisma.doctor.findMany({
        where,
        include: {
          user: {
            select: {
              userId: true,
              email: true,
              role: true,
              accountStatus: true,
            },
          },
          doctorServices: {
            include: {
              service: true,
            },
          },
        },
        orderBy: { fullName: 'asc' },
      });

      return doctors.map((doctor) => this.formatPublicDoctor(doctor));
    }

    // 2. ADMIN role: can view all doctors, with optional filters (?status=, ?search=, ?serviceId=)
    const where: Prisma.DoctorWhereInput = {};

    if (query.status && query.status !== 'ALL') {
      where.profileStatus = query.status === 'ACTIVE' ? ProfileStatus.ACTIVE : ProfileStatus.INACTIVE;
    }

    if (query.serviceId && query.serviceId.trim() !== '') {
      const trimmedServiceId = query.serviceId.trim();
      if (!isValidUuid(trimmedServiceId)) {
        return [];
      }
      where.doctorServices = {
        some: {
          serviceId: trimmedServiceId,
        },
      };
    }

    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { specialization: { contains: term, mode: 'insensitive' } },
        { professionalLicenseNumber: { contains: term, mode: 'insensitive' } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const doctors = await prisma.doctor.findMany({
      where,
      include: {
        user: {
          select: {
            userId: true,
            email: true,
            role: true,
            accountStatus: true,
          },
        },
        doctorServices: {
          include: {
            service: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return doctors.map(this.formatDoctor);
  }

  /**
   * Retrieves single doctor profile by doctorId.
   */
  async getDoctorById(doctorId: string, userRole: string) {
    if (!isValidUuid(doctorId)) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId },
      include: {
        user: {
          select: {
            userId: true,
            email: true,
            role: true,
            accountStatus: true,
          },
        },
        doctorServices: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!doctor) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    // Non-admin cannot inspect inactive doctor profiles (Anti-enumeration NFR-004)
    if (
      userRole !== 'ADMIN' &&
      (doctor.profileStatus !== ProfileStatus.ACTIVE || doctor.user.accountStatus !== AccountStatus.ACTIVE)
    ) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    return userRole === 'ADMIN' ? this.formatDoctor(doctor) : this.formatPublicDoctor(doctor);
  }

  /**
   * Creates a Doctor account atomically within a single PostgreSQL transaction.
   * - Validates duplicate email case-insensitively (409 EMAIL_ALREADY_EXISTS)
   * - Hashes password using Argon2id
   * - Creates User (role='DOCTOR', account_status='ACTIVE')
   * - Creates Doctor profile (profile_status='ACTIVE')
   * - Records AuditLog (action_type: 'DOCTOR_CREATED')
   */
  async createDoctor(adminUserId: string, input: CreateDoctorInput) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Initial check for existing email (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    if (existingUser) {
      throw AppError.conflict(
        'An account with this email address already exists.',
        'EMAIL_ALREADY_EXISTS'
      );
    }

    // 2. Hash password with Argon2id before entering the transaction
    const passwordHash = await hashPassword(input.password);

    // 3. Execute within a single atomic PostgreSQL transaction
    return prisma.$transaction(async (tx) => {
      // Guard against race conditions during transaction start
      const duplicateUser = await tx.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
      });

      if (duplicateUser) {
        throw AppError.conflict(
          'An account with this email address already exists.',
          'EMAIL_ALREADY_EXISTS'
        );
      }

      // 3a. Create User record
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: Role.DOCTOR,
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      // 3b. Create Doctor profile record
      const doctor = await tx.doctor.create({
        data: {
          userId: user.userId,
          fullName: input.fullName.trim(),
          specialization: input.specialization.trim(),
          professionalLicenseNumber: input.professionalLicenseNumber?.trim() || null,
          profileStatus: ProfileStatus.ACTIVE,
        },
      });

      // 3c. Record AuditLog entry
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          actionType: 'DOCTOR_CREATED',
          entityType: 'Doctor',
          entityId: doctor.doctorId,
          details: {
            email: user.email,
            fullName: doctor.fullName,
            specialization: doctor.specialization,
            professionalLicenseNumber: doctor.professionalLicenseNumber,
          },
        },
      });

      return {
        doctorId: doctor.doctorId,
        userId: user.userId,
        email: user.email,
        fullName: doctor.fullName,
        specialization: doctor.specialization,
        professionalLicenseNumber: doctor.professionalLicenseNumber,
        profileStatus: doctor.profileStatus,
        accountStatus: user.accountStatus,
        role: user.role,
        createdAt: doctor.createdAt,
        updatedAt: doctor.updatedAt,
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
        },
        doctorServices: [],
        services: [],
      };
    });
  }

  /**
   * Updates Doctor profile (fullName, specialization, professionalLicenseNumber).
   * Throws 404 Not Found if doctorId is not found.
   */
  async updateDoctor(doctorId: string, input: UpdateDoctorInput) {
    if (!isValidUuid(doctorId)) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    const existingDoctor = await prisma.doctor.findUnique({
      where: { doctorId },
    });

    if (!existingDoctor) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    const updated = await prisma.doctor.update({
      where: { doctorId },
      data: {
        fullName: input.fullName.trim(),
        specialization: input.specialization.trim(),
        professionalLicenseNumber:
          input.professionalLicenseNumber !== undefined
            ? input.professionalLicenseNumber?.trim() || null
            : existingDoctor.professionalLicenseNumber,
      },
      include: {
        user: {
          select: {
            userId: true,
            email: true,
            role: true,
            accountStatus: true,
          },
        },
        doctorServices: {
          include: {
            service: true,
          },
        },
      },
    });

    return this.formatDoctor(updated);
  }

  /**
   * Updates Doctor profile status and synchronizes User account status.
   * Atomically logs AuditLog (action_type: 'DOCTOR_STATUS_UPDATED').
   */
  async updateDoctorStatus(adminUserId: string, doctorId: string, profileStatus: ProfileStatus) {
    if (!isValidUuid(doctorId)) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    const existingDoctor = await prisma.doctor.findUnique({
      where: { doctorId },
      include: { user: true },
    });

    if (!existingDoctor) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    const targetAccountStatus =
      profileStatus === ProfileStatus.ACTIVE ? AccountStatus.ACTIVE : AccountStatus.INACTIVE;

    return prisma.$transaction(async (tx) => {
      // 1. Update Doctor.profile_status
      const updatedDoctor = await tx.doctor.update({
        where: { doctorId },
        data: {
          profileStatus,
        },
        include: {
          user: {
            select: {
              userId: true,
              email: true,
              role: true,
              accountStatus: true,
            },
          },
          doctorServices: {
            include: {
              service: true,
            },
          },
        },
      });

      // 2. Synchronize User.account_status accordingly
      const updatedUser = await tx.user.update({
        where: { userId: existingDoctor.userId },
        data: {
          accountStatus: targetAccountStatus,
        },
      });

      // 3. Record AuditLog entry
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          actionType: 'DOCTOR_STATUS_UPDATED',
          entityType: 'Doctor',
          entityId: doctorId,
          details: {
            previousProfileStatus: existingDoctor.profileStatus,
            newProfileStatus: profileStatus,
            previousAccountStatus: existingDoctor.user.accountStatus,
            newAccountStatus: updatedUser.accountStatus,
          },
        },
      });

      return {
        ...this.formatDoctor(updatedDoctor),
        accountStatus: updatedUser.accountStatus,
        user: {
          ...updatedDoctor.user,
          accountStatus: updatedUser.accountStatus,
        },
      };
    });
  }

  /**
   * Assigns a medical service to a doctor (F-005).
   * Validates doctor and service existence and prevents duplicate assignments (409 DUPLICATE_ASSIGNMENT).
   */
  async assignService(adminUserId: string, doctorId: string, serviceId: string) {
    if (!isValidUuid(doctorId)) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }
    if (!isValidUuid(serviceId)) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    const doctor = await prisma.doctor.findUnique({ where: { doctorId } });
    if (!doctor) {
      throw AppError.notFound('Doctor profile not found.', 'DOCTOR_NOT_FOUND');
    }

    const service = await prisma.medicalService.findUnique({ where: { serviceId } });
    if (!service) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    const existingAssignment = await prisma.doctorService.findUnique({
      where: {
        doctorId_serviceId: {
          doctorId,
          serviceId,
        },
      },
    });

    if (existingAssignment) {
      throw AppError.conflict('Doctor is already assigned to this service.', 'DUPLICATE_ASSIGNMENT');
    }

    const assignment = await prisma.doctorService.create({
      data: {
        doctorId,
        serviceId,
      },
      include: {
        service: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        actionType: 'DOCTOR_SERVICE_ASSIGNED',
        entityType: 'DoctorService',
        entityId: assignment.doctorServiceId,
        details: {
          doctorId,
          serviceId,
          serviceName: service.serviceName,
        },
      },
    });

    return assignment;
  }

  /**
   * Unassigns a medical service from a doctor (F-005).
   */
  async unassignService(adminUserId: string, doctorId: string, serviceId: string) {
    if (!isValidUuid(doctorId) || !isValidUuid(serviceId)) {
      throw AppError.notFound('Doctor-service assignment not found.', 'ASSIGNMENT_NOT_FOUND');
    }

    const assignment = await prisma.doctorService.findUnique({
      where: {
        doctorId_serviceId: {
          doctorId,
          serviceId,
        },
      },
    });

    if (!assignment) {
      throw AppError.notFound('Doctor-service assignment not found.', 'ASSIGNMENT_NOT_FOUND');
    }

    await prisma.doctorService.delete({
      where: {
        doctorId_serviceId: {
          doctorId,
          serviceId,
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        actionType: 'DOCTOR_SERVICE_UNASSIGNED',
        entityType: 'DoctorService',
        entityId: assignment.doctorServiceId,
        details: {
          doctorId,
          serviceId,
        },
      },
    });

    return { unassigned: true, doctorId, serviceId };
  }

  /**
   * Patient/Doctor-facing projection (FR-012, NFR-004): only what is needed to
   * choose a doctor. Contact e-mail, licence number, user/account identifiers
   * and INACTIVE services (BR-004) are never exposed to non-admin roles.
   */
  private formatPublicDoctor(doctor: any) {
    const services = (doctor.doctorServices || [])
      .map((ds: any) => ds.service)
      .filter((svc: any) => svc && svc.serviceStatus === ServiceStatus.ACTIVE)
      .map((svc: any) => ({
        serviceId: svc.serviceId,
        serviceName: svc.serviceName,
        description: svc.description,
        durationMinutes: svc.durationMinutes,
        serviceStatus: svc.serviceStatus,
      }));

    return {
      doctorId: doctor.doctorId,
      fullName: doctor.fullName,
      specialization: doctor.specialization,
      profileStatus: doctor.profileStatus,
      services,
    };
  }

  private formatDoctor(doctor: any) {
    const doctorServices = (doctor.doctorServices || []).map((ds: any) => ({
      doctorServiceId: ds.doctorServiceId,
      doctorId: ds.doctorId,
      serviceId: ds.serviceId,
      createdAt: ds.createdAt,
      service: ds.service
        ? {
            serviceId: ds.service.serviceId,
            serviceName: ds.service.serviceName,
            description: ds.service.description,
            durationMinutes: ds.service.durationMinutes,
            serviceStatus: ds.service.serviceStatus,
          }
        : undefined,
    }));

    const services = (doctor.doctorServices || [])
      .map((ds: any) => ds.service)
      .filter(Boolean);

    return {
      doctorId: doctor.doctorId,
      userId: doctor.userId,
      email: doctor.user?.email,
      fullName: doctor.fullName,
      specialization: doctor.specialization,
      professionalLicenseNumber: doctor.professionalLicenseNumber,
      profileStatus: doctor.profileStatus,
      accountStatus: doctor.user?.accountStatus,
      role: doctor.user?.role,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
      user: doctor.user
        ? {
            userId: doctor.user.userId,
            email: doctor.user.email,
            role: doctor.user.role,
            accountStatus: doctor.user.accountStatus,
          }
        : undefined,
      doctorServices,
      services,
    };
  }
}

export const doctorService = new DoctorService();

