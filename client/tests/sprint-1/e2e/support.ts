// ==============================================================================
// Appointly Client — E2E Support (sign-in, direct DB access)
// ==============================================================================
// The journeys drive the real UI. This file adds two things the UI cannot give us:
//   - `openDb()` : a Prisma client on the SAME database the API uses, so a test can prove a
//                  change really reached PostgreSQL and can put the data back afterwards.
//   - `signIn()` : the login form, driven like a user would.
// ==============================================================================

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'ChangeMe123!';

/** Accounts created by `server/prisma/seed.ts`. */
export const ACCOUNTS = {
  admin: 'admin@appointly.local',
  doctor: 'doctor@appointly.local',
  patient: 'patient.arisa@appointly.local',
} as const;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Signs in through the login form and waits until the app has left /login. */
export async function signIn(page: Page, email: string, password: string = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// --- direct database access ----------------------------------------------------
// The server owns the Prisma client (and its generated engine); resolve it the way the server does
// (from server/package.json), wherever npm hoisted it.
const serverRequire = createRequire(fileURLToPath(new URL('../../../../server/package.json', import.meta.url)));

export type Db = any;

export function openDb(): Db {
  const { PrismaClient } = serverRequire('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
}
