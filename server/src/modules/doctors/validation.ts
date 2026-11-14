// ==============================================================================
// Appointly Server — Doctor Validation Schemas
// ==============================================================================
// Reference: System-Level SDS Section 3.2C, 5.2 & Sprint 1 Contracts (F-003, F-005)
// Enforces validation rules on Doctor profile creation, updates, and status toggles.
// ==============================================================================

import { z } from 'zod';
import { ProfileStatus } from '@prisma/client';

/**
 * Validates doctor account creation: POST /api/v1/admin/doctors
 * - email: valid email format, max 255 chars
 * - password: min 8 characters, max 100 chars
 * - fullName: 1–150 characters
 * - specialization: 1–150 characters
 * - professionalLicenseNumber: max 100 characters, optional/nullable
 */
export const createDoctorSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address format')
    .max(255, 'Email must not exceed 255 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(100, 'Password must not exceed 100 characters'),
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(1, 'Full name must not be empty')
    .max(150, 'Full name must not exceed 150 characters'),
  specialization: z
    .string({ required_error: 'Specialization is required' })
    .trim()
    .min(1, 'Specialization must not be empty')
    .max(150, 'Specialization must not exceed 150 characters'),
  professionalLicenseNumber: z
    .string()
    .trim()
    .max(100, 'Professional license number must not exceed 100 characters')
    .optional()
    .nullable(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

/**
 * Validates doctor profile update: PUT /api/v1/admin/doctors/:doctorId
 * - fullName: 1–150 characters
 * - specialization: 1–150 characters
 * - professionalLicenseNumber: max 100 characters, optional/nullable
 */
export const updateDoctorSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(1, 'Full name must not be empty')
    .max(150, 'Full name must not exceed 150 characters'),
  specialization: z
    .string({ required_error: 'Specialization is required' })
    .trim()
    .min(1, 'Specialization must not be empty')
    .max(150, 'Specialization must not exceed 150 characters'),
  professionalLicenseNumber: z
    .string()
    .trim()
    .max(100, 'Professional license number must not exceed 100 characters')
    .optional()
    .nullable(),
});

export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

/**
 * Validates doctor status toggle: PATCH /api/v1/admin/doctors/:doctorId/status
 * - profileStatus: 'ACTIVE' | 'INACTIVE'
 */
export const updateDoctorStatusSchema = z.object({
  profileStatus: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.nativeEnum(ProfileStatus, {
      errorMap: () => ({ message: "Profile status must be either 'ACTIVE' or 'INACTIVE'" }),
    })
  ),
});

export type UpdateDoctorStatusInput = z.infer<typeof updateDoctorStatusSchema>;

/**
 * Validates doctor list query params: GET /api/v1/doctors
 * - status: 'ACTIVE' | 'INACTIVE' | 'ALL'
 * - search: string
 * - serviceId: string (UUID or empty)
 */
export const getDoctorsQuerySchema = z.object({
  status: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional()
    ),
  search: z.string().optional(),
  serviceId: z.string().optional(),
});

export type GetDoctorsQueryInput = z.infer<typeof getDoctorsQuerySchema>;

/**
 * Validates doctor-service assignment: POST /api/v1/admin/doctors/:doctorId/services
 */
export const assignServiceSchema = z.object({
  serviceId: z
    .string({ required_error: 'Service ID is required' })
    .uuid('Invalid service ID format'),
});

export type AssignServiceInput = z.infer<typeof assignServiceSchema>;

