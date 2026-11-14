// ==============================================================================
// Appointly Server — Role-Based Access Control (RBAC) Guard Middleware
// ==============================================================================
// Reference: System-Level SDS Section 6.2 (Gate 2) & Sprint 1 Contracts (F-001)
// Verifies that req.user.role matches the endpoint's allowed role set.
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { sendError } from '../utils/response';

/**
 * Middleware factory that enforces Role-Based Access Control on routes.
 * Rejects requests with 403 Forbidden if the authenticated user's role
 * is not in the allowed list.
 */
export function roleGuard(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        403,
        'FORBIDDEN',
        `Access forbidden: Role '${req.user.role}' lacks permission for this resource.`
      );
      return;
    }

    next();
  };
}

export default roleGuard;

