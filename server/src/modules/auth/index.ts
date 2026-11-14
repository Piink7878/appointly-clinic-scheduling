// ==============================================================================
// Appointly Server — Authentication Router
// ==============================================================================
// Reference: System-Level SDS Section 5.2 & Sprint 1 Contracts (F-001)
// ==============================================================================

import { Router } from 'express';
import { authController } from './controller';
import { authGuard } from '../../shared/middleware/authGuard';

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => authController.login(req, res, next));
authRouter.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
authRouter.post('/logout', (req, res, next) => authController.logout(req, res, next));
authRouter.get('/me', authGuard, (req, res, next) => authController.me(req, res, next));

export default authRouter;
