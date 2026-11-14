// ==============================================================================
// Appointly Server — Medical Service Validation Schemas
// ==============================================================================
// Reference: System-Level SDS Section 3.2D, 5.2 & Sprint 1 Contracts (F-004)
// Enforces validation rules on Medical Service creation, updates, and status toggles.
// ==============================================================================

import { z } from 'zod';
import { ServiceStatus } from '@prisma/client';

/**
 * Validates service creation: POST /api/v1/admin/services
 * - serviceName: 1–150 characters, trimmed, not empty
 * - description: optional text
 * - durationMinutes: positive integer between 1 and 480 (defaults to 30 if omitted)
 */
export const createServiceSchema = z.object({
  serviceName: z
    .string({ required_error: 'Service name is required' })
    .trim()
    .min(1, 'Service name must not be empty')
    .max(150, 'Service name must not exceed 150 characters'),
  description: z
    .string()
    .trim()
    .max(5000, 'Description must not exceed 5000 characters')
    .optional()
    .nullable()
    .transform((val) => (val === undefined || val === null ? null : val.trim() || null)),
  durationMinutes: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return 30;
      if (typeof val === 'string' && val.trim() !== '') return Number(val);
      return val;
    },
    z
      .number({
        invalid_type_error: 'Duration in minutes must be a number',
      })
      .int('Duration in minutes must be an integer')
      .min(1, 'Duration must be between 1 and 480 minutes')
      .max(480, 'Duration must be between 1 and 480 minutes')
      .default(30)
  ),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Validates service update: PUT /api/v1/admin/services/:serviceId
 * - serviceName: 1–150 characters, trimmed, not empty
 * - description: optional text
 * - durationMinutes: positive integer between 1 and 480
 */
export const updateServiceSchema = z.object({
  serviceName: z
    .string({ required_error: 'Service name is required' })
    .trim()
    .min(1, 'Service name must not be empty')
    .max(150, 'Service name must not exceed 150 characters'),
  description: z
    .string()
    .trim()
    .max(5000, 'Description must not exceed 5000 characters')
    .optional()
    .nullable()
    .transform((val) => (val === undefined || val === null ? null : val.trim() || null)),
  durationMinutes: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'string' && val.trim() !== '') return Number(val);
      return val;
    },
    z
      .number({
        invalid_type_error: 'Duration in minutes must be a number',
      })
      .int('Duration in minutes must be an integer')
      .min(1, 'Duration must be between 1 and 480 minutes')
      .max(480, 'Duration must be between 1 and 480 minutes')
      .optional()
  ),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/**
 * Validates service status toggle: PATCH /api/v1/admin/services/:serviceId/status
 * - serviceStatus: 'ACTIVE' | 'INACTIVE'
 */
export const updateServiceStatusSchema = z.object({
  serviceStatus: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.nativeEnum(ServiceStatus, {
      errorMap: () => ({ message: "Service status must be either 'ACTIVE' or 'INACTIVE'" }),
    })
  ),
});

export type UpdateServiceStatusInput = z.infer<typeof updateServiceStatusSchema>;

/**
 * Validates service list query params: GET /api/v1/services
 * - status: 'ACTIVE' | 'INACTIVE' | 'ALL'
 * - search: string
 */
export const getServicesQuerySchema = z.object({
  status: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional()
    ),
  search: z.string().optional(),
});

export type GetServicesQueryInput = z.infer<typeof getServicesQuerySchema>;
