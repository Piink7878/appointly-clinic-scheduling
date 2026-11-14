// ==============================================================================
// Appointly Server — Shared Types & Request Extensions
// ==============================================================================

import { Request } from 'express';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface AuthUserPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}
