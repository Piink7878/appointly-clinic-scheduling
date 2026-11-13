// ==============================================================================
// Appointly Server — Global Error Handling Middleware & AppError
// ==============================================================================
// Reference: System-Level SDS Section 5.3 & 7.2
// Standardizes API error responses: { success: false, error: { code, message } }
// Redacts sensitive PII and unhandled internal stack traces from client responses.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

/**
 * Standard Application Error representing deliberate HTTP errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST'): AppError {
    return new AppError(400, code, message);
  }

  static unauthorized(message = 'Unauthorized access.', code = 'UNAUTHORIZED'): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'Forbidden resource.', code = 'FORBIDDEN'): AppError {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Resource not found.', code = 'NOT_FOUND'): AppError {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code = 'CONFLICT'): AppError {
    return new AppError(409, code, message);
  }

  static unprocessable(message: string, code = 'UNPROCESSABLE_ENTITY'): AppError {
    return new AppError(422, code, message);
  }

  static internal(
    message = 'An unexpected internal error occurred.',
    code = 'INTERNAL_SERVER_ERROR'
  ): AppError {
    return new AppError(500, code, message);
  }
}

/**
 * Global Express error handling middleware.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    return next(err);
  }

  // 1. Handled Domain AppError
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  // 2. Zod Schema Validation Error
  if (err instanceof ZodError) {
    const errorDetails = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    sendError(res, 400, 'VALIDATION_ERROR', errorDetails || 'Invalid request payload');
    return;
  }

  // 3. Prisma Database Error Handling
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint violation
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : 'field';
      sendError(res, 409, 'CONFLICT', `A record with this ${target} already exists.`);
      return;
    }
    // P2025: Record not found
    if (err.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Requested record was not found.');
      return;
    }
    // P2003: Foreign key constraint failed
    if (err.code === 'P2003') {
      sendError(res, 400, 'BAD_REQUEST', 'Foreign key constraint violated on referenced entity.');
      return;
    }
  }

  // 4. Malformed JSON Body Syntax Error
  if (err instanceof SyntaxError && 'body' in (err as unknown as Record<string, unknown>)) {
    sendError(res, 400, 'INVALID_JSON', 'Malformed JSON payload in request body.');
    return;
  }

  // 5. Unhandled Internal Server Errors
  logger.error('Unhandled internal server error:', err);
  sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected internal error occurred.');
};

export default errorHandler;
