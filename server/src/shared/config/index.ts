// ==============================================================================
// Appointly Server — Configuration & Environment Validation
// ==============================================================================
// Reference: System-Level SDS Section 8.2 & Sprint 1 Contracts
// ==============================================================================

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  CLINIC_TIMEZONE: z.string().default('Asia/Bangkok'),
  CLINIC_DEFAULT_TIMEZONE: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@appointly.local'),
  SEED_DEFAULT_PASSWORD: z.string().default('ChangeMe123!'),
});

const isTestEnv = process.env.NODE_ENV === 'test';

const rawEnv = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '4000',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    (isTestEnv
      ? 'postgresql://appointly:appointly_dev_secret@localhost:5432/appointly?schema=public'
      : undefined),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  COOKIE_SECURE: process.env.COOKIE_SECURE || 'false',
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ||
    (isTestEnv ? 'test_access_jwt_secret_32bytes_minimum_length_placeholder' : undefined),
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ||
    (isTestEnv ? 'test_refresh_jwt_secret_32bytes_minimum_length_placeholder' : undefined),
  CLINIC_TIMEZONE:
    process.env.CLINIC_TIMEZONE ||
    process.env.CLINIC_DEFAULT_TIMEZONE ||
    'Asia/Bangkok',
  CLINIC_DEFAULT_TIMEZONE: process.env.CLINIC_DEFAULT_TIMEZONE,
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'admin@appointly.local',
  SEED_DEFAULT_PASSWORD: process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!',
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
  throw new Error(`[Config Error] Invalid server environment variables: ${issues}`);
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  corsOrigin: env.CORS_ORIGIN,
  cookieSecure: env.COOKIE_SECURE,
  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  clinicTimezone: env.CLINIC_TIMEZONE,
  seedAdminEmail: env.SEED_ADMIN_EMAIL,
  seedDefaultPassword: env.SEED_DEFAULT_PASSWORD,
};

export type Config = typeof config;
export default config;
