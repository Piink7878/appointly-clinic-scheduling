// ==============================================================================
// Appointly Server — Authentication Guard Middleware
// ==============================================================================
// Reference: System-Level SDS Section 6.2 (Gate 1) & Sprint 1 Contracts (F-001)
// Verifies JWT signature and expiry from HttpOnly cookie and attaches req.user.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, ACCESS_TOKEN_COOKIE } from '../utils/security';
import { sendError } from '../utils/response';

/**
 * Middleware that authenticates requests using the access_token cookie
 * (with fallback to the Authorization Bearer header).
 */
export function authGuard(req: Request, res: Response, next: NextFunction): void {
  // 1. Extract access token from HttpOnly cookie or Authorization header
  let token = req.cookies?.[ACCESS_TOKEN_COOKIE];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }

  if (!token) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication token is required.');
    return;
  }

  // 2. Cryptographic signature and expiration verification
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired access token.');
  }
}

export default authGuard;

