// ==============================================================================
// Appointly Server — API v1 Root Router
// ==============================================================================
// Reference: System-Level SDS Section 5.1 & 5.2
// Mounts health checks and domain feature modules under /api/v1
// ==============================================================================

import { Router } from 'express';
import { prisma } from '../shared/database';
import { logger } from '../shared/utils/logger';
import { authRouter } from '../modules/auth';
import { patientsRouter } from '../modules/patients';
import { doctorsRouter } from '../modules/doctors';
import { servicesRouter } from '../modules/services';
import { schedulesRouter } from '../modules/schedules';
import { settingsRouter } from '../modules/settings';
import { appointmentsRouter } from '../modules/appointments';
import { notificationsRouter } from '../modules/notifications';
import { reportsRouter } from '../modules/reports';

export const apiRouter = Router();

/**
 * Liveness probe: returns 200 OK when Express server is running.
 * GET /api/v1/health
 */
apiRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Readiness probe: verifies live PostgreSQL connectivity with SELECT 1.
 * GET /api/v1/ready
 */
apiRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.status(200).json({ db: 'connected' });
  } catch (error) {
    logger.error('PostgreSQL database readiness check failed:', error);
    res.status(503).json({ db: 'disconnected' });
  }
});

// Domain Feature Module Routes
apiRouter.use('/auth', authRouter);
apiRouter.use('/patients', patientsRouter);
apiRouter.use('/doctors', doctorsRouter);
apiRouter.use('/services', servicesRouter);
apiRouter.use('/schedules', schedulesRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/reports', reportsRouter);

export default apiRouter;
