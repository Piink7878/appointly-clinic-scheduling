// ==============================================================================
// Appointly Server — Authentication Controller
// ==============================================================================
// Reference: System-Level SDS Section 5.2 & Sprint 1 Contracts (F-001)
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { authService } from './service';
import { loginSchema } from './validation';
import {
  setAuthCookies,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from '../../shared/utils/security';
import { sendSuccess } from '../../shared/utils/response';
import { AppError } from '../../shared/middleware/errorHandler';

export class AuthController {
  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const result = await authService.login(input);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        success: true,
        data: result.user,
        userId: result.user.userId,
        email: result.user.email,
        role: result.user.role,
        message: 'Login successful.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      if (!refreshToken) {
        throw AppError.unauthorized('Refresh token is required.', 'REFRESH_TOKEN_REQUIRED');
      }

      const result = await authService.rotateRefreshToken(refreshToken);

      setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(200).json({
        success: true,
        data: result.user,
        userId: result.user.userId,
        email: result.user.email,
        role: result.user.role,
        message: 'Tokens refreshed successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      await authService.logout(req.user?.userId, refreshToken);

      clearAuthCookies(res);

      sendSuccess(res, null, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.userId) {
        throw AppError.unauthorized('Authentication token is required.', 'UNAUTHORIZED');
      }

      const meData = await authService.getMe(req.user.userId);

      res.status(200).json({
        success: true,
        data: meData,
        ...meData,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

