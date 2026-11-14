// ==============================================================================
// Appointly Server — Patient Management Integration & API Tests (F-002)
// ==============================================================================
// Reference: System-Level SDS Section 3.2B, 5.2, 6, 7.2 & Sprint 1 Contracts (F-002)
// Test Catalog: STS-S1-003, STS-S1-004
// Acceptance Criteria:
//   - AC-F002-01 (Positive — Self Profile View & Update)
//   - AC-F002-02 (Negative — Role & Ownership Restriction)
//   - AC-F002-03 (Boundary — Validation Constraints)
// ==============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';

describe('Patient Management System (F-002)', () => {
  const validPassword = 'ChangeMe123!';
  const patientEmail = 'patient.arisa@appointly.local';
  const secondPatientEmail = 'patient@appointly.local';
  const doctorEmail = 'doctor@appointly.local';
  const adminEmail = 'admin@appointly.local';

  let patientCookies: string[];
  let secondPatientCookies: string[];
  let doctorCookies: string[];
  let adminCookies: string[];

  let patientUser: { userId: string; email: string };
  let secondPatientUser: { userId: string; email: string };

  beforeAll(async () => {
    // 1. Authenticate patient (patient.arisa@appointly.local)
    const patientLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: patientEmail, password: validPassword });
    expect(patientLogin.status).toBe(200);
    patientCookies = patientLogin.headers['set-cookie'];
    patientUser = patientLogin.body.data;

    // 2. Authenticate second patient (patient@appointly.local)
    const secondLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: secondPatientEmail, password: validPassword });
    expect(secondLogin.status).toBe(200);
    secondPatientCookies = secondLogin.headers['set-cookie'];
    secondPatientUser = secondLogin.body.data;

    // 3. Authenticate doctor (doctor@appointly.local)
    const doctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: doctorEmail, password: validPassword });
    expect(doctorLogin.status).toBe(200);
    doctorCookies = doctorLogin.headers['set-cookie'];

    // 4. Authenticate admin (admin@appointly.local)
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: validPassword });
    expect(adminLogin.status).toBe(200);
    adminCookies = adminLogin.headers['set-cookie'];
  });

  // ============================================================================
  // 1. AC-F002-01 / STS-S1-004 (Positive — Self Profile View & Update)
  // ============================================================================
  describe('1. AC-F002-01 / STS-S1-004 (Positive — Self Profile View & Update)', () => {
    it('should complete full lifecycle: log in, call GET /api/v1/patients/me, update profile via PUT /api/v1/patients/me (200 OK), and confirm persistence via DB and subsequent GET', async () => {
      // Step A: Initial profile inspection via GET /api/v1/patients/me
      const initialGetRes = await request(app)
        .get('/api/v1/patients/me')
        .set('Cookie', patientCookies);

      expect(initialGetRes.status).toBe(200);
      expect(initialGetRes.body.success).toBe(true);
      expect(initialGetRes.body.data.userId).toBe(patientUser.userId);
      expect(initialGetRes.body.data.email).toBe(patientEmail);
      expect(initialGetRes.body.data.patientId).toBeDefined();

      // Step B: Submit updated profile data via PUT /api/v1/patients/me
      const updatePayload = {
        fullName: 'Arisa Wongsuwan (Updated)',
        phoneNumber: '0898765432',
        dateOfBirth: '1992-08-20',
      };

      const putRes = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send(updatePayload);

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.data.fullName).toBe(updatePayload.fullName);
      expect(putRes.body.data.phoneNumber).toBe(updatePayload.phoneNumber);
      expect(putRes.body.data.userId).toBe(patientUser.userId);

      // Step C: Verify direct PostgreSQL persistence via Prisma
      const dbRecord = await prisma.patient.findUnique({
        where: { userId: patientUser.userId },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.fullName).toBe(updatePayload.fullName);
      expect(dbRecord?.phoneNumber).toBe(updatePayload.phoneNumber);

      // Step D: Subsequent GET /api/v1/patients/me confirms updated data is permanently saved
      const subsequentGetRes = await request(app)
        .get('/api/v1/patients/me')
        .set('Cookie', patientCookies);

      expect(subsequentGetRes.status).toBe(200);
      expect(subsequentGetRes.body.success).toBe(true);
      expect(subsequentGetRes.body.data.fullName).toBe(updatePayload.fullName);
      expect(subsequentGetRes.body.data.phoneNumber).toBe(updatePayload.phoneNumber);
      expect(subsequentGetRes.body.data.userId).toBe(patientUser.userId);
      expect(subsequentGetRes.body.data.email).toBe(patientEmail);
    });

    it('should support updating phoneNumber with international standard E.164 format (+66898765432)', async () => {
      const e164Payload = {
        fullName: 'Arisa Wongsuwan (E164)',
        phoneNumber: '+66898765432',
      };

      const res = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send(e164Payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phoneNumber).toBe(e164Payload.phoneNumber);

      // Confirm DB persistence
      const dbPatient = await prisma.patient.findUnique({
        where: { userId: patientUser.userId },
      });
      expect(dbPatient?.phoneNumber).toBe(e164Payload.phoneNumber);
    });

    it('should strictly reference req.user.userId on server-side and ignore client-supplied patientId or userId in query or body', async () => {
      const spoofedUserId = secondPatientUser.userId;

      // GET with spoofed query params
      const getRes = await request(app)
        .get(`/api/v1/patients/me?userId=${spoofedUserId}&patientId=${spoofedUserId}`)
        .set('Cookie', patientCookies);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.userId).toBe(patientUser.userId);
      expect(getRes.body.data.userId).not.toBe(spoofedUserId);

      // PUT with spoofed body params
      const targetInitial = await prisma.patient.findUnique({
        where: { userId: spoofedUserId },
      });

      const putRes = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send({
          userId: spoofedUserId,
          patientId: targetInitial?.patientId,
          fullName: 'Unauthorized Tamper Attempt',
          phoneNumber: '0812345678',
        });

      expect(putRes.status).toBe(200);

      // Verify the other patient was NOT modified
      const targetAfter = await prisma.patient.findUnique({
        where: { userId: spoofedUserId },
      });
      expect(targetAfter?.fullName).toBe(targetInitial?.fullName);
    });
  });

  // ============================================================================
  // 2. AC-F002-02 / STS-S1-003 (Negative — Role & Ownership Restriction)
  // ============================================================================
  describe('2. AC-F002-02 / STS-S1-003 (Negative — Role & Ownership Restriction)', () => {
    it('should reject a DOCTOR requesting GET /api/v1/patients/me with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/patients/me')
        .set('Cookie', doctorCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject a DOCTOR requesting PUT /api/v1/patients/me with 403 Forbidden', async () => {
      const res = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', doctorCookies)
        .send({
          fullName: 'Dr. Trying To Update Patient Profile',
          phoneNumber: '0812345678',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('STS-S1-003: should reject a PATIENT requesting GET /api/v1/admin/patients with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/patients')
        .set('Cookie', patientCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject a DOCTOR requesting GET /api/v1/admin/patients with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/patients')
        .set('Cookie', doctorCookies);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject unauthenticated requests to /api/v1/patients/me with 401 Unauthorized', async () => {
      const getRes = await request(app).get('/api/v1/patients/me');
      expect(getRes.status).toBe(401);
      expect(getRes.body.success).toBe(false);

      const putRes = await request(app)
        .put('/api/v1/patients/me')
        .send({ fullName: 'Nobody', phoneNumber: '0812345678' });
      expect(putRes.status).toBe(401);
      expect(putRes.body.success).toBe(false);
    });

    it('should reject unauthenticated requests to /api/v1/admin/patients with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/patients');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should allow an ADMIN calling GET /api/v1/admin/patients?search=... to successfully search for patients (200 OK)', async () => {
      // 1. Search by fullName (case-insensitive)
      const resName = await request(app)
        .get('/api/v1/admin/patients?search=arisa')
        .set('Cookie', adminCookies);

      expect(resName.status).toBe(200);
      expect(resName.body.success).toBe(true);
      expect(resName.body.data.items).toBeDefined();
      expect(resName.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(
        resName.body.data.items.some((p: { fullName: string }) =>
          p.fullName.toLowerCase().includes('arisa')
        )
      ).toBe(true);

      // 2. Search by email (joined from User table, case-insensitive)
      const resEmail = await request(app)
        .get('/api/v1/admin/patients?search=PATIENT.ARISA@APPOINTLY.LOCAL')
        .set('Cookie', adminCookies);

      expect(resEmail.status).toBe(200);
      expect(resEmail.body.success).toBe(true);
      expect(resEmail.body.data.items.length).toBe(1);
      expect(resEmail.body.data.items[0].email).toBe(patientEmail);

      // 3. Search by phoneNumber
      const resPhone = await request(app)
        .get('/api/v1/admin/patients?search=08')
        .set('Cookie', adminCookies);

      expect(resPhone.status).toBe(200);
      expect(resPhone.body.success).toBe(true);
      expect(resPhone.body.data.items.length).toBeGreaterThanOrEqual(1);

      // 4. Verify pagination metadata (items, total, page, limit)
      const resPagination = await request(app)
        .get('/api/v1/admin/patients?page=1&limit=20')
        .set('Cookie', adminCookies);

      expect(resPagination.status).toBe(200);
      expect(resPagination.body.success).toBe(true);
      const data = resPagination.body.data;
      expect(Array.isArray(data.items)).toBe(true);
      expect(typeof data.total).toBe('number');
      expect(data.page).toBe(1);
      expect(data.limit).toBe(20);
    });
  });

  // ============================================================================
  // 3. AC-F002-03 / STS-S1-004 (Boundary — Validation Constraints)
  // ============================================================================
  describe('3. AC-F002-03 / STS-S1-004 (Boundary — Validation Constraints)', () => {
    it('should reject PUT /api/v1/patients/me with 400 Bad Request when fullName is empty string ""', async () => {
      const res = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send({
          fullName: '',
          phoneNumber: '0812345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject PUT /api/v1/patients/me with 400 Bad Request when fullName is whitespace-only "   "', async () => {
      const res = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send({
          fullName: '     ',
          phoneNumber: '0812345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject PUT /api/v1/patients/me with 400 Bad Request when fullName exceeds 150 characters', async () => {
      const res = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send({
          fullName: 'A'.repeat(151),
          phoneNumber: '0812345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject PUT /api/v1/patients/me with 400 Bad Request when phoneNumber format is invalid', async () => {
      const invalidPhoneFormats = [
        '12345',         // too short
        'not-a-phone',   // alphabetic string
        '021234567',     // Thai landline (starts with 02, not mobile 0[689])
        '08123456',      // 8 digits (needs 10)
        '0812345678901', // too long
        '+0123456789',   // invalid E.164 country code (+0)
      ];

      for (const invalidPhone of invalidPhoneFormats) {
        const res = await request(app)
          .put('/api/v1/patients/me')
          .set('Cookie', patientCookies)
          .send({
            fullName: 'Valid Name',
            phoneNumber: invalidPhone,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });

    it('should reject PUT /api/v1/patients/me with 400 Bad Request when dateOfBirth is set to tomorrow (current_date + 1 day)', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send({
          fullName: 'Valid Name',
          phoneNumber: '0812345678',
          dateOfBirth: tomorrowStr,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject PUT /api/v1/patients/me with 400 Bad Request when dateOfBirth is set to today (current_date is not < current_date)', async () => {
      const todayStr = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send({
          fullName: 'Valid Name',
          phoneNumber: '0812345678',
          dateOfBirth: todayStr,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject PUT /api/v1/patients/me with 400 Bad Request when dateOfBirth is not a valid date string', async () => {
      const res = await request(app)
        .put('/api/v1/patients/me')
        .set('Cookie', patientCookies)
        .send({
          fullName: 'Valid Name',
          phoneNumber: '0812345678',
          dateOfBirth: 'invalid-non-date',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // 4. PDPA Data Minimization & Clinical Scope Boundary Verification
  // ============================================================================
  describe('4. PDPA Data Minimization & Clinical Scope Boundary Verification', () => {
    it('should ensure patient profile response contains strictly demographic/contact fields and ZERO medical/EMR fields', async () => {
      const res = await request(app)
        .get('/api/v1/patients/me')
        .set('Cookie', patientCookies);

      expect(res.status).toBe(200);
      const data = res.body.data;

      const forbiddenFields = [
        'diagnosis',
        'diagnoses',
        'prescription',
        'prescriptions',
        'treatment',
        'treatments',
        'medicalHistory',
        'emr',
        'ehr',
        'labResults',
        'allergies',
        'symptoms',
        'vitals',
      ];

      for (const field of forbiddenFields) {
        expect(data[field]).toBeUndefined();
        expect(res.body[field]).toBeUndefined();
      }
    });

    it('should ensure admin patient directory response contains ZERO medical/EMR fields', async () => {
      const res = await request(app)
        .get('/api/v1/admin/patients')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      const items = res.body.data.items;

      const forbiddenFields = [
        'diagnosis',
        'prescription',
        'treatment',
        'medicalHistory',
        'emr',
        'ehr',
        'labResults',
      ];

      for (const item of items) {
        for (const field of forbiddenFields) {
          expect((item as Record<string, unknown>)[field]).toBeUndefined();
        }
      }
    });
  });
});
