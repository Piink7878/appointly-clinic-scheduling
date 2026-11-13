// ==============================================================================
// Appointly Server — Standardized API Response Helpers
// ==============================================================================
// Reference: System-Level SDS Section 5.3
// Enforces standard JSON response envelope structure across all controller endpoints.
// ==============================================================================

import { Response } from 'express';

export interface SuccessEnvelope<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Sends a standardized success response.
 * Envelope: { success: true, data?, message? }
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response {
  const body: SuccessEnvelope<T> = {
    success: true,
  };

  if (data !== undefined) {
    body.data = data;
  }
  if (message !== undefined) {
    body.message = message;
  }

  return res.status(statusCode).json(body);
}

/**
 * Sends a standardized error response.
 * Envelope: { success: false, error: { code, message } }
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string
): Response {
  const body: ErrorEnvelope = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return res.status(statusCode).json(body);
}

