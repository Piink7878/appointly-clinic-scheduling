// ==============================================================================
// Appointly Server — Clinic Settings Service Layer
// ==============================================================================
// Reference: System-Level SDS Section 3.2K, 3.2L, 5.2, 6 & Sprint 1 Contracts (F-007)
// Manages clinic-wide operational parameters and configuration audit logging.
// ==============================================================================

import { type Prisma } from '@prisma/client';
import { prisma } from '../../shared/database';
import { type UpdateSettingsInput } from './validation';
import { CLINIC_TIMEZONE } from '../../shared/utils/timezone';

const SETTING_FIELDS = [
  'clinicName',
  'timezone',
  'fixedStartIntervalMinutes',
  'cancellationCutoffHours',
  'reminderLeadHours',
] as const;

export class SettingsService {
  /**
   * Retrieves or creates the singleton ClinicSetting record.
   */
  async getOrCreateSingleton(tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    let setting = await client.clinicSetting.findFirst();

    if (!setting) {
      setting = await client.clinicSetting.create({
        data: {
          clinicName: 'Appointly Clinic',
          timezone: CLINIC_TIMEZONE,
          fixedStartIntervalMinutes: 15,
          cancellationCutoffHours: 24,
          reminderLeadHours: 24,
        },
      });
    }

    return setting;
  }

  /**
   * Retrieves the full ClinicSetting record.
   */
  async getSettings() {
    return this.getOrCreateSingleton();
  }

  /**
   * Retrieves public clinic settings:
   * { clinicName, timezone, fixedStartIntervalMinutes, cancellationCutoffHours }
   */
  async getPublicSettings() {
    const setting = await this.getOrCreateSingleton();
    return {
      clinicName: setting.clinicName,
      timezone: setting.timezone,
      fixedStartIntervalMinutes: setting.fixedStartIntervalMinutes,
      cancellationCutoffHours: setting.cancellationCutoffHours,
    };
  }

  /**
   * Updates the ClinicSetting singleton and writes an AuditLog entry.
   */
  async updateSettings(input: UpdateSettingsInput, adminUserId?: string) {
    return prisma.$transaction(async (tx) => {
      const current = await this.getOrCreateSingleton(tx);

      // Only fields that actually change are written. A PATCH that changes nothing
      // (including 0 -> 0: zero is a real value, never "unset") neither writes nor audits.
      const changedFields = SETTING_FIELDS.filter((f) => input[f] !== undefined && input[f] !== current[f]);
      if (changedFields.length === 0) {
        return current;
      }

      const updateData: Prisma.ClinicSettingUpdateInput = Object.fromEntries(
        changedFields.map((f) => [f, input[f]])
      );
      if (adminUserId) {
        updateData.updater = { connect: { userId: adminUserId } };
      }

      const updated = await tx.clinicSetting.update({
        where: { settingId: current.settingId },
        data: updateData,
      });

      if (adminUserId) {
        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            actionType: 'CLINIC_SETTINGS_UPDATED',
            entityType: 'ClinicSetting',
            entityId: updated.settingId,
            details: {
              updatedFields: changedFields,
              previous: {
                clinicName: current.clinicName,
                timezone: current.timezone,
                fixedStartIntervalMinutes: current.fixedStartIntervalMinutes,
                cancellationCutoffHours: current.cancellationCutoffHours,
                reminderLeadHours: current.reminderLeadHours,
              },
              current: {
                clinicName: updated.clinicName,
                timezone: updated.timezone,
                fixedStartIntervalMinutes: updated.fixedStartIntervalMinutes,
                cancellationCutoffHours: updated.cancellationCutoffHours,
                reminderLeadHours: updated.reminderLeadHours,
              },
            },
          },
        });
      }

      return updated;
    });
  }
}

export const settingsService = new SettingsService();
export default settingsService;

