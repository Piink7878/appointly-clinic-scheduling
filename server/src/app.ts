// ==============================================================================
// Appointly Server — Express Application Setup
// ==============================================================================
// Reference: System-Level SDS Section 1.2 & 5.1
// Mounts global middlewares, API v1 routes, static SPA serving, and error handling.
// ==============================================================================

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { config } from './shared/config';
import { prisma } from './shared/database';
import { logger } from './shared/utils/logger';
import { errorHandler } from './shared/middleware';
import { apiRouter } from './routes';

export const app = express();

// Global Middlewares
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// API v1 Base Route
app.use('/api/v1', apiRouter);

// Compatibility aliases for health & smoke checks
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.status(200).json({ db: 'connected' });
  } catch (error) {
    logger.error('PostgreSQL database readiness check failed:', error);
    res.status(503).json({ db: 'disconnected' });
  }
});

// Production SPA Static File Serving (from /app/client/dist or local client/dist)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use(errorHandler);

export default app;
