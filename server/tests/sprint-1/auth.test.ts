// ==============================================================================
// Appointly Server — Authentication & RBAC Integration Tests (F-001)
// ==============================================================================
// Reference: System-Level SDS Section 5.2, 6, 7 & Sprint 1 Contracts
// Test Catalog: STS-S1-001, STS-S1-002, STS-S1-003
// Acceptance Criteria: AC-F001-01, AC-F001-02, AC-F001-03, AC-F001-04
// ==============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';

describe('Auth & RBAC System (F-001)', () => {
  const validPassword = 'ChangeMe123!';
  const adminEmail = 'admin@appointly.local';
  const doctorEmail = 'doctor@appointly.local';
  const patientEmail = 'patient@appointly.local';
  const inactiveEmail = 'inactive@appointly.local';

  beforeAll(async () => {
    // Verify seeded test accounts exist in the test database
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    const doctor = await prisma.user.findUnique({ where: { email: doctorEmail } });
    const patient = await prisma.user.findUnique({ where: { email: patientEmail } });
    const inactive = await prisma.user.findUnique({ where: { email: inactiveEmail } });

    if (!admin || !doctor || !patient || !inactive) {
      throw new Error('Seed data missing: please run `npx prisma db seed` before running test suites');
    }
  });

  // ============================================================================
  // AC-F001-01 / STS-S1-001 (Positive)
  // Login with Seeded Accounts (PATIENT, DOCTOR, ADMIN), HttpOnly cookies,
  // Role verification via /auth/me matching DB, and Logout revoking session
  // ============================================================================
  describe('AC-F001-01 / STS-S1-001 (Positive): Login, Identity Retrieval & Logout Lifecycle', () => {
    const seededAccounts = [
      { role: 'PATIENT', email: patientEmail },
      { role: 'DOCTOR', email: doctorEmail },
      { role: 'ADMIN', email: adminEmail },
    ] as const;

    for (const account of seededAccounts) {
      it(`should successfully authenticate ${account.role} (${account.email}), set HttpOnly cookies, verify role via /auth/me matching database, and revoke session upon logout`, async () => {
        // 1. Submit valid credentials to POST /api/v1/auth/login
        const loginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: account.email, password: validPassword });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.success).toBe(true);
        expect(loginRes.body.data.role).toBe(account.role);
        expect(loginRes.body.data.email).toBe(account.email);
        expect(loginRes.body.data.userId).toBeDefined();

        // 2. Validate HttpOnly and SameSite=Strict cookies
        const cookies = loginRes.headers['set-cookie'];
        expect(cookies).toBeDefined();
        const cookieStr = cookies.join(';');
        expect(cookieStr).toContain('access_token=');
        expect(cookieStr).toContain('refresh_token=');
        expect(cookieStr.toLowerCase()).toContain('httponly');
        expect(cookieStr.toLowerCase()).toContain('samesite=strict');

        // 3. Query PostgreSQL directly to verify user role and persistence
        const dbUser = await prisma.user.findUnique({ where: { email: account.email } });
        expect(dbUser).not.toBeNull();
        expect(dbUser?.role).toBe(account.role);
        expect(dbUser?.refreshTokenHash).not.toBeNull();

        // 4. Request GET /api/v1/auth/me with session cookies and assert role matches DB
        const meRes = await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', cookies);

        expect(meRes.status).toBe(200);
        expect(meRes.body.success).toBe(true);
        expect(meRes.body.data.role).toBe(dbUser?.role);
        expect(meRes.body.data.email).toBe(account.email);
        expect(meRes.body.data.accountStatus).toBe('ACTIVE');
        expect(meRes.body.data.userId).toBe(dbUser?.userId);

        // 5. Call POST /api/v1/auth/logout with cookies
        const logoutRes = await request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', cookies);

        expect(logoutRes.status).toBe(200);
        expect(logoutRes.body.success).toBe(true);

        // Verify cookies are expired in the response
        const clearCookies = logoutRes.headers['set-cookie'];
        expect(clearCookies).toBeDefined();
        const clearCookieStr = clearCookies.join(';');
        expect(clearCookieStr).toMatch(/access_token=;.*expires=/i);
        expect(clearCookieStr).toMatch(/refresh_token=;.*expires=/i);

        // Verify refresh_token_hash in PostgreSQL is now revoked (NULL)
        const userAfterLogout = await prisma.user.findUnique({ where: { email: account.email } });
        expect(userAfterLogout?.refreshTokenHash).toBeNull();

        // 6. Calling /auth/me with the previous cookies results in 401 Unauthorized
        const meAfterLogout = await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', cookies);

        expect(meAfterLogout.status).toBe(401);
        expect(meAfterLogout.body.success).toBe(false);
        expect(meAfterLogout.body.error.code).toBe('UNAUTHORIZED');

        // 7. Calling /auth/me with cleared cookies also results in 401 Unauthorized
        const meWithClearedCookies = await request(app)
          .get('/api/v1/auth/me')
          .set('Cookie', clearCookies);

        expect(meWithClearedCookies.status).toBe(401);
        expect(meWithClearedCookies.body.success).toBe(false);
        expect(meWithClearedCookies.body.error.code).toBe('UNAUTHORIZED');
      });
    }
  });

  // ============================================================================
  // AC-F001-02 / STS-S1-002 (Negative — Invalid Credentials)
  // Incorrect password, unknown email (anti-enumeration), input normalization
  // ============================================================================
  describe('AC-F001-02 / STS-S1-002 (Negative): Invalid Credentials & Input Handling', () => {
    it('should return 401 Unauthorized on invalid password without revealing account existence', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: doctorEmail, password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('should return 401 Unauthorized on unknown email with identical generic error message', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent.user@appointly.local', password: 'SomePassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password.');
    });

    it('should accept whitespace-padded and case-insensitive email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: '   DOCTOR@appointly.local   ', password: validPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(doctorEmail);
    });

    it('should reject malformed email with 400 Bad Request (VALIDATION_ERROR)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid-email-format', password: validPassword });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing password with 400 Bad Request (VALIDATION_ERROR)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: doctorEmail });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================================================
  // AC-F001-03 / STS-S1-003 (Negative — Unauthenticated & RBAC)
  // Unauthenticated requests -> 401; PATIENT and DOCTOR on /admin/* -> 403 Forbidden
  // ============================================================================
  describe('AC-F001-03 / STS-S1-003 (Negative): Unauthenticated Access & RBAC Privilege Guards', () => {
    let patientCookies: string[];
    let doctorCookies: string[];
    let adminCookies: string[];

    beforeAll(async () => {
      const pLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: patientEmail, password: validPassword });
      patientCookies = pLogin.headers['set-cookie'];

      const dLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: doctorEmail, password: validPassword });
      doctorCookies = dLogin.headers['set-cookie'];

      const aLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: validPassword });
      adminCookies = aLogin.headers['set-cookie'];
    });

    it('should return 401 Unauthorized when requesting GET /api/v1/auth/me without cookies', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 Unauthorized when requesting /api/v1/admin/* without cookies', async () => {
      const res = await request(app).get('/api/v1/admin/patients');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject PATIENT tokens accessing /api/v1/admin/patients with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/patients')
        .set('Cookie', patientCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject PATIENT tokens accessing POST /api/v1/admin/services with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', patientCookies)
        .send({ serviceName: 'Unauthorized Service' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject DOCTOR tokens accessing GET /api/v1/admin/patients with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/patients')
        .set('Cookie', doctorCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject DOCTOR tokens accessing PATCH /api/v1/admin/settings with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', doctorCookies)
        .send({ fixedStartIntervalMinutes: 30 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow ADMIN tokens to access /api/v1/admin/* endpoints with 200/201 OK', async () => {
      const resPatients = await request(app)
        .get('/api/v1/admin/patients')
        .set('Cookie', adminCookies);
      expect(resPatients.status).toBe(200);
      expect(resPatients.body.success).toBe(true);

      // Ensure test idempotency by removing previous test service if present
      const existingPed = await prisma.medicalService.findMany({
        where: { serviceName: 'Pediatrics Consultation' },
      });
      if (existingPed.length > 0) {
        const pedIds = existingPed.map((s) => s.serviceId);
        await prisma.auditLog.deleteMany({ where: { entityId: { in: pedIds } } });
        await prisma.medicalService.deleteMany({ where: { serviceId: { in: pedIds } } });
      }

      const resServices = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({ serviceName: 'Pediatrics Consultation' });
      expect(resServices.status).toBe(201);
      expect(resServices.body.success).toBe(true);

      const createdPedId = resServices.body?.data?.serviceId || resServices.body?.serviceId;
      if (createdPedId) {
        await prisma.auditLog.deleteMany({ where: { entityId: createdPedId } });
        await prisma.medicalService.deleteMany({ where: { serviceId: createdPedId } });
      }

      const resSettings = await request(app)
        .patch('/api/v1/admin/settings')
        .set('Cookie', adminCookies)
        .send({ timezone: 'Asia/Bangkok' });
      expect(resSettings.status).toBe(200);
      expect(resSettings.body.success).toBe(true);
    });
  });

  // ============================================================================
  // AC-F001-04 / STS-S1-001 (Boundary — Inactive Account)
  // Dynamic update to INACTIVE and pre-seeded INACTIVE account rejection
  // ============================================================================
  describe('AC-F001-04 / STS-S1-001 (Boundary): Inactive Account Login Rejection', () => {
    it('should reject login with 403 Forbidden (ACCOUNT_INACTIVE) when an active account is updated to INACTIVE in PostgreSQL', async () => {
      // 1. Temporarily update active patient account to INACTIVE
      await prisma.user.update({
        where: { email: patientEmail },
        data: { accountStatus: 'INACTIVE' },
      });

      try {
        // 2. Attempt login with the now INACTIVE account
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: patientEmail, password: validPassword });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
        expect(res.body.error.message).toContain('Account is inactive');
      } finally {
        // 3. Guarantee restoration back to ACTIVE so other test suites remain green
        await prisma.user.update({
          where: { email: patientEmail },
          data: { accountStatus: 'ACTIVE' },
        });
      }

      // 4. Verify account successfully logs in once restored to ACTIVE
      const restoredRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: patientEmail, password: validPassword });

      expect(restoredRes.status).toBe(200);
      expect(restoredRes.body.success).toBe(true);
    });

    it('should reject login for pre-seeded INACTIVE account with 403 Forbidden (ACCOUNT_INACTIVE)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: inactiveEmail, password: validPassword });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
      expect(res.body.error.message).toContain('Account is inactive');
    });
  });

  // ============================================================================
  // Token Lifecycle: Refresh Token Rotation & Session Revocation
  // ============================================================================
  describe('Token Rotation & Session Management (POST /api/v1/auth/refresh)', () => {
    it('should rotate access and refresh tokens when a valid refresh cookie is provided', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: patientEmail, password: validPassword });

      const initialCookies = loginRes.headers['set-cookie'];
      const refreshCookie = initialCookies.find((c: string) => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeDefined();

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.email).toBe(patientEmail);

      const newCookies = refreshRes.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      const newCookieStr = newCookies.join(';');
      expect(newCookieStr).toContain('access_token=');
      expect(newCookieStr).toContain('refresh_token=');
    });

    it('should return 401 Unauthorized if refresh cookie is missing', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_REQUIRED');
    });

    it('should return 401 Unauthorized if refresh token is forged or invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refresh_token=forged.invalid.token']);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
});
