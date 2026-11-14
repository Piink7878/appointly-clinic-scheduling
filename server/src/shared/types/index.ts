// ==============================================================================
// Appointly Server — Shared Types & Request Extensions
// ==============================================================================

import { type Request } from 'express';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface AuthUserPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  // Augmenting Express's own `Express.Request` is only possible through a namespace declaration.
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
