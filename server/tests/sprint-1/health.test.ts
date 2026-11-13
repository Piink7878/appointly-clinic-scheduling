// ==============================================================================
// Appointly Server — Foundation, Health, Readiness & Shared Core Tests
// ==============================================================================
// Reference: System-Level SDS Section 5.1, 5.3, 7.2 & Sprint 1 Contracts
// ==============================================================================

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';
import { config } from '../../src/shared/config';
import {
  formatUtcToTimezone,
  toBangkokDateString,
  toBangkokTimeString,
  parseBangkokToUtc,
  isValidTimezone,
  BANGKOK_TIMEZONE,
} from '../../src/shared/utils/timezone';
import { sanitizeLogData } from '../../src/shared/utils/logger';
import { errorHandler, AppError } from '../../src/shared/middleware/errorHandler';

describe('Server Foundation & Health Checks', () => {
  it('GET /api/v1/health should return status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/health compatibility check should return status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/ready should verify PostgreSQL connection with SELECT 1 and return db connected', async () => {
    const res = await request(app).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ db: 'connected' });
  });

  it('GET /api/ready compatibility check should return db connected', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ db: 'connected' });
  });

  it('GET /api/v1/ready should return 503 and db disconnected when DB query fails', async () => {
    // Mock prisma.$queryRawUnsafe to simulate DB failure
    const spy = vi.spyOn(prisma, '$queryRawUnsafe').mockRejectedValueOnce(new Error('Connection lost'));

    const res = await request(app).get('/api/v1/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ db: 'disconnected' });

    spy.mockRestore();
  });
});

describe('Shared Config Environment Validation', () => {
  it('should have validated environment configuration loaded', () => {
    expect(config.databaseUrl).toBeDefined();
    expect(config.jwtAccessSecret).toBeDefined();
    expect(config.jwtAccessSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.jwtRefreshSecret).toBeDefined();
    expect(config.jwtRefreshSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.port).toBeTypeOf('number');
    expect(config.corsOrigin).toBeDefined();
    expect(config.clinicTimezone).toBe('Asia/Bangkok');
  });
});

describe('Shared Middleware: Error Handling & Envelope', () => {
  const createErrorTestApp = () => {
    const testApp = express();
    testApp.use(express.json());

    testApp.get('/test/app-error', () => {
      throw AppError.badRequest('Invalid input parameter provided', 'INVALID_PARAM');
    });

    testApp.get('/test/conflict-error', () => {
      throw AppError.conflict('Schedule window collision detected', 'SLOT_UNAVAILABLE');
    });

    testApp.get('/test/validation-error', () => {
      const schema = z.object({ email: z.string().email() });
      schema.parse({ email: 'not-an-email' });
    });

    testApp.get('/test/unhandled-error', () => {
      throw new Error('Unexpected disk failure');
    });

    testApp.use(errorHandler);
    return testApp;
  };

  it('should format AppError into standardized error envelope', async () => {
    const testApp = createErrorTestApp();
    const res = await request(testApp).get('/test/app-error');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_PARAM',
        message: 'Invalid input parameter provided',
      },
    });
  });

  it('should format conflict AppError into 409 status code', async () => {
    const testApp = createErrorTestApp();
    const res = await request(testApp).get('/test/conflict-error');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'SLOT_UNAVAILABLE',
        message: 'Schedule window collision detected',
      },
    });
  });

  it('should format ZodError into 400 validation error envelope', async () => {
    const testApp = createErrorTestApp();
    const res = await request(testApp).get('/test/validation-error');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('email');
  });

  it('should format unexpected errors into 500 standardized error envelope without leaking stack', async () => {
    const testApp = createErrorTestApp();
    const res = await request(testApp).get('/test/unhandled-error');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred.',
      },
    });
  });
});

describe('Shared Utils: UTC <-> Asia/Bangkok Time Conversion', () => {
  it('should format UTC date correctly to Bangkok timezone (UTC+7)', () => {
    // 2026-11-14T02:00:00Z in UTC is 09:00:00 in Bangkok (UTC+7)
    const utcDate = new Date('2026-11-14T02:00:00.000Z');
    expect(toBangkokDateString(utcDate)).toBe('2026-11-14');
    expect(toBangkokTimeString(utcDate)).toBe('09:00:00');
    expect(formatUtcToTimezone(utcDate, BANGKOK_TIMEZONE)).toBe('2026-11-14T09:00:00');
  });

  it('should parse Bangkok date and time into correct UTC Date', () => {
    // 2026-11-14 09:00:00 in Bangkok should equal 2026-11-14T02:00:00.000Z in UTC
    const parsedUtc = parseBangkokToUtc('2026-11-14', '09:00:00');
    expect(parsedUtc.toISOString()).toBe('2026-11-14T02:00:00.000Z');
  });

  it('should validate IANA timezone strings', () => {
    expect(isValidTimezone('Asia/Bangkok')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
  });
});

describe('Shared Utils: PII-Safe Logger Redaction', () => {
  it('should redact sensitive keys including passwords, tokens, and secrets', () => {
    const rawData = {
      email: 'doctor@appointly.local',
      password: 'PlainSecretPassword123!',
      passwordHash: '$argon2id$...',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      refreshToken: 'sample_refresh_token',
      nested: {
        access_token: 'secret_token_123',
        safeField: 'safeValue',
      },
    };

    const sanitized = sanitizeLogData(rawData) as Record<string, unknown>;
    expect(sanitized.email).toBe('doctor@appointly.local');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.passwordHash).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).access_token).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).safeField).toBe('safeValue');
  });

  it('should redact Bearer authorization header strings', () => {
    const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.xyz';
    const sanitized = sanitizeLogData(authHeader);
    expect(sanitized).toBe('Bearer [REDACTED]');
  });
});
