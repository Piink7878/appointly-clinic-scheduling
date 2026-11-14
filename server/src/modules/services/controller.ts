// ==============================================================================
// Appointly Server — Medical Service Catalog Controller
// ==============================================================================
// Reference: System-Level SDS Section 3.2D, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-004)
// Handles endpoints for medical service catalog listing, creation, updates, and status toggles.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { serviceService } from './service';
import {
  createServiceSchema,
  updateServiceSchema,
  updateServiceStatusSchema,
  getServicesQuerySchema,
} from './validation';
import { AppError } from '../../shared/middleware/errorHandler';

import { sendSuccess } from '../../shared/utils/response';
export class ServiceController {
  /**
   * GET /api/v1/services
   * Requires: authGuard + roleGuard('PATIENT', 'DOCTOR', 'ADMIN')
   * - PATIENT / DOCTOR: filter and return only services with service_status === 'ACTIVE' (FR-016, FR-018, BR-004).
   * - ADMIN: return the full list of services (supporting query filters ?status=ACTIVE|INACTIVE and ?search=).
   */
  async getServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = getServicesQuerySchema.parse(req.query);
      const userRole = req.user?.role || 'PATIENT';
      const services = await serviceService.getServices(userRole, query);

      sendSuccess(res, services, 'Medical services retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/services/:serviceId
   * Requires: authGuard + roleGuard('PATIENT', 'DOCTOR', 'ADMIN')
   */
  async getServiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceId = req.params.serviceId;
      const userRole = req.user?.role || 'PATIENT';
      const service = await serviceService.getServiceById(serviceId, userRole);

      sendSuccess(res, service, 'Medical service retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/services
   * Requires: authGuard + roleGuard('ADMIN')
   * Accepts: { serviceName, description?, durationMinutes }
   * Creates a MedicalService record (service_status = 'ACTIVE') and records an AuditLog (SERVICE_CREATED).
   * Returns: 201 Created
   */
  async createService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const validatedInput = createServiceSchema.parse(req.body);
      const createdService = await serviceService.createService(req.user.userId, validatedInput);

      sendSuccess(res, createdService, 'Medical service created successfully.', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/services/:serviceId
   * Requires: authGuard + roleGuard('ADMIN')
   * Accepts: { serviceName, description?, durationMinutes }
   * Returns: 200 OK or 404 Not Found if serviceId is not found.
   */
  async updateService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const serviceId = req.params.serviceId;
      const validatedInput = updateServiceSchema.parse(req.body);
      const updatedService = await serviceService.updateService(req.user.userId, serviceId, validatedInput);

      sendSuccess(res, updatedService, 'Medical service updated successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/services/:serviceId/status
   * Requires: authGuard + roleGuard('ADMIN')
   * Accepts: { serviceStatus: 'ACTIVE' | 'INACTIVE' }
   * Updates the service status along with recording an AuditLog (SERVICE_STATUS_UPDATED).
   * Returns: 200 OK
   */
  async updateServiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const serviceId = req.params.serviceId;
      const rawStatus = req.body?.serviceStatus ?? req.body?.status;
      const validated = updateServiceStatusSchema.parse({ serviceStatus: rawStatus });
      const updatedService = await serviceService.updateServiceStatus(
        req.user.userId,
        serviceId,
        validated.serviceStatus
      );

      sendSuccess(res, updatedService, 'Medical service status updated successfully.', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const serviceController = new ServiceController();

