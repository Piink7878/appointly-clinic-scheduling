// ==============================================================================
// Appointly Server — Login Brute-Force Protection (F-001, SDS 7.1)
// ==============================================================================
// Reference: System-Level SDS Sections 5.3 (429) & 7.1; Sprint 1 Contracts AC-F001-02
// Uses the real app and the real account lockout configuration (default: 10 failed
// attempts per account per 15 minutes).
// ==============================================================================

import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { config } from '../../../src/shared/config';
import { loginLimiter } from '../../../src/shared/middleware';
import { prisma } from '../../../src/shared/database';

const LIMIT = config.loginRateLimit.maxPerAccount;
const login = (email: string, password: string) => request(app).post('/api/v1/auth/login').send({ email, password });

describe('Login brute-force protection', () => {
  afterAll(async () => {
    loginLimiter.reset();
    await prisma.$disconnect();
  });

  it(`locks an account with 429 TOO_MANY_REQUESTS after ${LIMIT} failed attempts, with Retry-After`, async () => {
    const email = `brute.force.${Date.now()}@appointly.local`;

    for (let attempt = 1; attempt <= LIMIT; attempt += 1) {
      const res = await login(email, `wrong-${attempt}`);
      expect(res.status, `attempt ${attempt}`).toBe(401);
    }

    const locked = await login(email, 'one-more');
    expect(locked.status).toBe(429);
    expect(locked.body).toMatchObject({ success: false, error: { code: 'TOO_MANY_REQUESTS' } });
    expect(typeof locked.body.error.message).toBe('string');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(locked.headers['retry-after'])).toBeLessThanOrEqual(config.loginRateLimit.windowMinutes * 60);
  });

  it('keeps a locked account locked even for the CORRECT password (otherwise guessing could simply continue)', async () => {
    const email = 'inactive@appointly.local'; // a real seeded account; its sign-in is refused anyway
    for (let i = 0; i < LIMIT; i += 1) await login(email, `wrong-${i}`);

    const withRightPassword = await login(email, 'ChangeMe123!');
    expect(withRightPassword.status).toBe(429);
    expect(withRightPassword.headers['set-cookie']).toBeUndefined();
  });

  it('does not affect other accounts', async () => {
    const res = await login('admin@appointly.local', 'ChangeMe123!');
    expect(res.status).toBe(200);
  });

  it('a successful sign-in resets the count, so ordinary typos never accumulate', async () => {
    loginLimiter.reset();
    const email = 'patient@appointly.local';
    for (let i = 0; i < LIMIT - 1; i += 1) expect((await login(email, `typo-${i}`)).status).toBe(401);

    expect((await login(email, 'ChangeMe123!')).status).toBe(200); // resets

    for (let i = 0; i < LIMIT - 1; i += 1) expect((await login(email, `typo-again-${i}`)).status).toBe(401);
    expect((await login(email, 'ChangeMe123!')).status).toBe(200); // still not locked
  });

  it('is case- and whitespace-insensitive about the e-mail (no bypass by changing the spelling)', async () => {
    loginLimiter.reset();
    const base = `Case.Bypass.${Date.now()}@Appointly.Local`;
    for (let i = 0; i < LIMIT; i += 1) {
      await login(i % 2 === 0 ? base : `  ${base.toLowerCase()}  `, `wrong-${i}`);
    }
    expect((await login(base.toUpperCase(), 'anything')).status).toBe(429);
  });

  it('answers a locked-out attempt in the standard error envelope, and does not extend the lock by itself', async () => {
    loginLimiter.reset();
    const email = `envelope.${Date.now()}@appointly.local`;
    for (let i = 0; i < LIMIT; i += 1) await login(email, `wrong-${i}`);

    const first = await login(email, 'x');
    const retryFirst = Number(first.headers['retry-after']);
    await login(email, 'y'); // blocked attempts are not "failures": the clock does not restart
    const second = await login(email, 'z');
    expect(second.status).toBe(429);
    expect(Number(second.headers['retry-after'])).toBeLessThanOrEqual(retryFirst);
    expect(Object.keys(second.body).sort()).toEqual(['error', 'success']);
  });

  it('an unknown e-mail takes about as long as a wrong password (no account enumeration by timing)', async () => {
    loginLimiter.reset();
    const time = async (email: string) => {
      const started = process.hrtime.bigint();
      await login(email, 'definitely-wrong');
      return Number(process.hrtime.bigint() - started) / 1e6;
    };

    await time('warm.up@appointly.local'); // first call hashes the decoy
    const unknown = Math.min(...(await Promise.all([1, 2, 3].map((i) => time(`nobody.${i}.${Date.now()}@appointly.local`)))));
    const known = Math.min(...(await Promise.all([1, 2, 3].map(() => time('patient.arisa@appointly.local')))));

    // an Argon2 verify takes tens of milliseconds; without the decoy the unknown path would be ~1 ms
    expect(unknown).toBeGreaterThan(known * 0.4);
    loginLimiter.reset();
  });
});
