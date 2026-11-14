// ==============================================================================
// Appointly Server — Medical Service Catalog Management Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2D, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-004)
// Handles service catalog queries, atomic service creation with audit logging,
// service updates, and status toggles.
// ==============================================================================

import { Prisma, ServiceStatus } from '@prisma/client';
import { prisma } from '../../shared/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { isValidUuid } from '../../shared/utils/uuid';
import { isUniqueViolation } from '../../shared/utils/prismaErrors';
import {
  CreateServiceInput,
  UpdateServiceInput,
  GetServicesQueryInput,
} from './validation';

export class ServiceService {
  /**
   * Retrieves list of medical services according to requester role and query filters.
   * - PATIENT / DOCTOR: strictly returns only services with serviceStatus === 'ACTIVE' (FR-016, FR-018, BR-004).
   * - ADMIN: returns all services, supporting query filters ?status=ACTIVE|INACTIVE and ?search=.
   */
  async getServices(userRole: string, query: GetServicesQueryInput = {}) {
    const isAdmin = userRole === 'ADMIN';

    // 1. Non-admin roles (PATIENT, DOCTOR) can ONLY view ACTIVE services
    if (!isAdmin) {
      const where: Prisma.MedicalServiceWhereInput = {
        serviceStatus: ServiceStatus.ACTIVE,
      };

      if (query.search && query.search.trim() !== '') {
        const term = query.search.trim();
        where.OR = [
          { serviceName: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ];
      }

      return prisma.medicalService.findMany({
        where,
        orderBy: { serviceName: 'asc' },
      });
    }

    // 2. ADMIN role can view all services with optional ?status= and ?search= filters
    const where: Prisma.MedicalServiceWhereInput = {};

    if (query.status && query.status !== 'ALL') {
      where.serviceStatus = query.status === 'ACTIVE' ? ServiceStatus.ACTIVE : ServiceStatus.INACTIVE;
    }

    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      where.OR = [
        { serviceName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    return prisma.medicalService.findMany({
      where,
      orderBy: { serviceName: 'asc' },
    });
  }

  /**
   * Retrieves a single medical service by ID.
   * - PATIENT / DOCTOR: throws 404 if not found or if serviceStatus !== 'ACTIVE' (NFR-004).
   * - ADMIN: returns the service regardless of status.
   */
  async getServiceById(serviceId: string, userRole: string) {
    if (!isValidUuid(serviceId)) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    const service = await prisma.medicalService.findUnique({
      where: { serviceId },
    });

    if (!service) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    if (userRole !== 'ADMIN' && service.serviceStatus !== ServiceStatus.ACTIVE) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    return service;
  }

  /**
   * Creates a new medical service record (service_status = 'ACTIVE') and records an AuditLog.
   * Requires: roleGuard('ADMIN')
   */
  async createService(adminUserId: string, input: CreateServiceInput) {
    const trimmedName = input.serviceName.trim();

    // Check unique case-insensitively
    const existing = await prisma.medicalService.findFirst({
      where: {
        serviceName: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw AppError.conflict(
        `A medical service with name '${trimmedName}' already exists.`,
        'SERVICE_NAME_EXISTS'
      );
    }

    return prisma.$transaction(async (tx) => {
      const service = await tx.medicalService.create({
        data: {
          serviceName: trimmedName,
          description: input.description ?? null,
          durationMinutes: input.durationMinutes,
          serviceStatus: ServiceStatus.ACTIVE,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          actionType: 'SERVICE_CREATED',
          entityType: 'MedicalService',
          entityId: service.serviceId,
          details: {
            serviceName: service.serviceName,
            description: service.description,
            durationMinutes: service.durationMinutes,
            serviceStatus: service.serviceStatus,
          },
        },
      });

      return service;
    }).catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw AppError.conflict(
          `A medical service with name '${trimmedName}' already exists.`,
          'SERVICE_NAME_EXISTS'
        );
      }
      throw error;
    });
  }

  /**
   * Updates an existing medical service (serviceName, description, durationMinutes).
   * Requires: roleGuard('ADMIN')
   */
  async updateService(adminUserId: string, serviceId: string, input: UpdateServiceInput) {
    if (!isValidUuid(serviceId)) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    const existing = await prisma.medicalService.findUnique({
      where: { serviceId },
    });

    if (!existing) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    const trimmedName = input.serviceName.trim();

    // Check unique case-insensitively against other existing services
    const duplicate = await prisma.medicalService.findFirst({
      where: {
        serviceName: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        NOT: {
          serviceId,
        },
      },
    });

    if (duplicate) {
      throw AppError.conflict(
        `A medical service with name '${trimmedName}' already exists.`,
        'SERVICE_NAME_EXISTS'
      );
    }

    const next = {
      serviceName: trimmedName,
      description: input.description !== undefined ? input.description : existing.description,
      durationMinutes: input.durationMinutes !== undefined ? input.durationMinutes : existing.durationMinutes,
    };
    const previous = {
      serviceName: existing.serviceName,
      description: existing.description,
      durationMinutes: existing.durationMinutes,
    };
    const changed =
      previous.serviceName !== next.serviceName ||
      previous.description !== next.description ||
      previous.durationMinutes !== next.durationMinutes;

    // The change and its AuditLog entry (SERVICE_UPDATED) are one atomic unit.
    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.medicalService.update({ where: { serviceId }, data: next });

        if (changed) {
          await tx.auditLog.create({
            data: {
              userId: adminUserId,
              actionType: 'SERVICE_UPDATED',
              entityType: 'MedicalService',
              entityId: serviceId,
              details: { previous, current: next },
            },
          });
        }

        return row;
      });
    } catch (error) {
      // A concurrent rename won the UNIQUE(service_name) race.
      if (isUniqueViolation(error)) {
        throw AppError.conflict(
          `A medical service with name '${trimmedName}' already exists.`,
          'SERVICE_NAME_EXISTS'
        );
      }
      throw error;
    }
  }

  /**
   * Toggles or updates medical service status ('ACTIVE' | 'INACTIVE') and records an AuditLog.
   * Requires: roleGuard('ADMIN')
   */
  async updateServiceStatus(adminUserId: string, serviceId: string, newStatus: ServiceStatus) {
    if (!isValidUuid(serviceId)) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    const existing = await prisma.medicalService.findUnique({
      where: { serviceId },
    });

    if (!existing) {
      throw AppError.notFound('Medical service not found.', 'SERVICE_NOT_FOUND');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.medicalService.update({
        where: { serviceId },
        data: {
          serviceStatus: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          actionType: 'SERVICE_STATUS_UPDATED',
          entityType: 'MedicalService',
          entityId: serviceId,
          details: {
            previousServiceStatus: existing.serviceStatus,
            newServiceStatus: newStatus,
            previousStatus: existing.serviceStatus,
            newStatus,
            serviceName: existing.serviceName,
          },
        },
      });

      return updated;
    });
  }
}

export const serviceService = new ServiceService();
