// ==============================================================================
// Appointly Server — Auth Module Request Schemas
// ==============================================================================
// Reference: System-Level SDS Section 5.2 & Sprint 1 Contracts (F-001)
// ==============================================================================

import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address format'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password must not be empty'),
});

export type LoginInput = z.infer<typeof loginSchema>;
