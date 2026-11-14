// ==============================================================================
// Appointly Server — Global Error Handling Middleware & AppError
// ==============================================================================
// Reference: System-Level SDS Section 5.3 & 7.2
// Standardizes API error responses: { success: false, error: { code, message } }
// Redacts sensitive PII and unhandled internal stack traces from client responses.
// ==============================================================================

import { type Request, type Response, type NextFunction } from 'express';
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

/** body-parser / http-errors `type` -> standard envelope (never leak parser internals). */
const FRAMEWORK_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  'entity.too.large': { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' },
  'entity.parse.failed': { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON payload in request body.' },
  'charset.unsupported': { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported request charset.' },
  'encoding.unsupported': { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported request encoding.' },
  'request.aborted': { status: 400, code: 'BAD_REQUEST', message: 'The request was aborted before it completed.' },
  'request.size.invalid': { status: 400, code: 'BAD_REQUEST', message: 'The request body size is invalid.' },
};
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
    if (err.code === 'P2023' || err.code === 'P2000' || err.code === 'P2020') {
      // Malformed / out-of-range value reached the database (bad UUID text, string too long, number out of range).
      sendError(res, 400, 'BAD_REQUEST', 'A supplied value has an invalid format or is out of range.');
      return;
    }
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
  // 4xx errors raised by Express/body-parser (http-errors): payload too large, unsupported charset, aborted body…
  const framework = err as { status?: unknown; statusCode?: unknown; type?: unknown };
  const frameworkStatus = typeof framework.status === 'number' ? framework.status : framework.statusCode;
  if (err instanceof Error && typeof frameworkStatus === 'number' && frameworkStatus >= 400 && frameworkStatus < 500) {
    const known = FRAMEWORK_ERRORS[String(framework.type)];
    sendError(
      res,
      known?.status ?? frameworkStatus,
      known?.code ?? 'BAD_REQUEST',
      known?.message ?? 'The request could not be processed.'
    );
    return;
  }

  logger.error('Unhandled internal server error:', err);
  sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected internal error occurred.');
};

export default errorHandler;
