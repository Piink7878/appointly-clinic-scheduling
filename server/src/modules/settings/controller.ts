// ==============================================================================
// Appointly Server — Clinic Settings Controller Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2K, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-007)
// Exposes HTTP endpoints for public clinic settings reading and admin updates.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { settingsService } from './service';
import { updateSettingsSchema } from './validation';
import { AppError } from '../../shared/middleware/errorHandler';

import { sendSuccess } from '../../shared/utils/response';
export class SettingsController {
  /**
   * GET /api/v1/settings/public
   * Public or Authenticated for all roles.
   * Returns { clinicName, timezone, fixedStartIntervalMinutes, cancellationCutoffHours }.
   */
  async getPublicSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicSettings = await settingsService.getPublicSettings();
      sendSuccess(res, publicSettings, 'Public clinic settings retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/settings
   * Admin only. Returns full ClinicSetting record.
   */
  async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      sendSuccess(res, settings, 'Clinic settings retrieved successfully.', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/settings
   * Admin only.
   * Validates payload, updates ClinicSetting singleton, and records AuditLog (CLINIC_SETTINGS_UPDATED).
   */
  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const validatedInput = updateSettingsSchema.parse(req.body);
      const updated = await settingsService.updateSettings(
        validatedInput,
        req.user.userId
      );

      sendSuccess(res, updated, 'Clinic settings updated successfully.', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
export default settingsController;

