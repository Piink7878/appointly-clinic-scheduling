// ==============================================================================
// Appointly Server — Medical Service Catalog Integration & API Tests (F-004)
// ==============================================================================
// Reference: System-Level SDS Section 3.2D, 3.2L, 5.2, 6, 7 & Sprint 1 Contracts (F-004)
// Test Catalog: STS-S1-003, STS-S1-006
// Acceptance Criteria:
//   - AC-F004-01 (Positive — Service Lifecycle)
//   - AC-F004-02 (Negative — Inactive Service Exclusion & RBAC)
//   - AC-F004-03 (Boundary — Duration Limits & Duplicate Name)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';

describe('Medical Service Catalog Management (F-004)', () => {
  const validPassword = 'ChangeMe123!';
  const patientEmail = 'patient.arisa@appointly.local';
  const doctorEmail = 'doctor@appointly.local';
  const adminEmail = 'admin@appointly.local';

  let patientCookies: string[];
  let doctorCookies: string[];
  let adminCookies: string[];
  let adminUserId: string;

  // Track created service IDs for cleanup
  const createdServiceIds: string[] = [];

  beforeAll(async () => {
    // 1. Authenticate patient (patient.arisa@appointly.local)
    const patientLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: patientEmail, password: validPassword });
    expect(patientLogin.status).toBe(200);
    patientCookies = patientLogin.headers['set-cookie'];

    // 2. Authenticate doctor (doctor@appointly.local)
    const doctorLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: doctorEmail, password: validPassword });
    expect(doctorLogin.status).toBe(200);
    doctorCookies = doctorLogin.headers['set-cookie'];

    // 3. Authenticate admin (admin@appointly.local)
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: validPassword });
    expect(adminLogin.status).toBe(200);
    adminCookies = adminLogin.headers['set-cookie'];
    adminUserId = adminLogin.body.data.userId;
  });

  afterAll(async () => {
    // Clean up created test services and their audit logs
    if (createdServiceIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          entityId: { in: createdServiceIds },
        },
      });

      await prisma.doctorService.deleteMany({
        where: {
          serviceId: { in: createdServiceIds },
        },
      });

      await prisma.medicalService.deleteMany({
        where: {
          serviceId: { in: createdServiceIds },
        },
      });
    }
  });

  // ============================================================================
  // 1. AC-F004-01 / STS-S1-006 (Positive — Service Lifecycle)
  // ============================================================================
  describe('1. AC-F004-01 / STS-S1-006 (Positive — Service Lifecycle)', () => {
    it('Admin successfully creates a new service (durationMinutes = 45, ACTIVE) via POST /api/v1/admin/services (201 Created), verifies records exist in MedicalService and AuditLog tables, and Patient sees the service with duration of 45 minutes via GET /api/v1/services', async () => {
      const uniqueName = `Cardiology Consultation ${Date.now()}`;
      const payload = {
        serviceName: uniqueName,
        description: 'Comprehensive outpatient cardiovascular examination.',
        durationMinutes: 45,
      };

      // Step A: Admin creates service via POST /api/v1/admin/services (201 Created)
      const createRes = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send(payload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.serviceId).toBeDefined();
      expect(createRes.body.data.serviceName).toBe(uniqueName);
      expect(createRes.body.data.description).toBe(payload.description);
      expect(createRes.body.data.durationMinutes).toBe(45);
      expect(createRes.body.data.serviceStatus).toBe('ACTIVE');

      const serviceId = createRes.body.data.serviceId;
      createdServiceIds.push(serviceId);

      // Step B: Verify record exists directly in MedicalService table
      const dbService = await prisma.medicalService.findUnique({
        where: { serviceId },
      });
      expect(dbService).not.toBeNull();
      expect(dbService?.serviceName).toBe(uniqueName);
      expect(dbService?.durationMinutes).toBe(45);
      expect(dbService?.serviceStatus).toBe('ACTIVE');

      // Step C: Verify record exists directly in AuditLog table (actionType = SERVICE_CREATED)
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: serviceId,
          actionType: 'SERVICE_CREATED',
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(adminUserId);
      expect(auditLog?.entityType).toBe('MedicalService');

      // Step D: Patient calls GET /api/v1/services, verifies service is visible with duration of 45 minutes
      const patientListRes = await request(app)
        .get('/api/v1/services')
        .set('Cookie', patientCookies);

      expect(patientListRes.status).toBe(200);
      expect(patientListRes.body.success).toBe(true);
      expect(Array.isArray(patientListRes.body.data)).toBe(true);
      const found = patientListRes.body.data.find((s: any) => s.serviceId === serviceId);
      expect(found).toBeDefined();
      expect(found.serviceName).toBe(uniqueName);
      expect(found.durationMinutes).toBe(45);
      expect(found.serviceStatus).toBe('ACTIVE');
    });

    it('Doctor role can view active services via GET /api/v1/services (200 OK)', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('Cookie', doctorCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((svc: any) => {
        expect(svc.serviceStatus).toBe('ACTIVE');
      });
    });

    it('Admin can view all services via GET /api/v1/services and GET /api/v1/admin/services', async () => {
      const res1 = await request(app)
        .get('/api/v1/services')
        .set('Cookie', adminCookies);
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      const res2 = await request(app)
        .get('/api/v1/admin/services')
        .set('Cookie', adminCookies);
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.data.length).toBe(res1.body.data.length);
    });

    it('Admin can filter services with query parameters ?status= and ?search=', async () => {
      const uniqueName = `Specialized Dermatology ${Date.now()}`;
      const createRes = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: uniqueName,
          description: 'Special skin treatment and lesion inspection.',
          durationMinutes: 45,
        });
      expect(createRes.status).toBe(201);
      createdServiceIds.push(createRes.body.data.serviceId);

      // Search by keyword
      const searchRes = await request(app)
        .get(`/api/v1/services?search=dermatology`)
        .set('Cookie', adminCookies);
      expect(searchRes.status).toBe(200);
      const matches = searchRes.body.data.filter((s: any) => s.serviceName === uniqueName);
      expect(matches.length).toBe(1);

      // Filter by status=ACTIVE
      const activeRes = await request(app)
        .get(`/api/v1/services?status=ACTIVE`)
        .set('Cookie', adminCookies);
      expect(activeRes.status).toBe(200);
      activeRes.body.data.forEach((s: any) => {
        expect(s.serviceStatus).toBe('ACTIVE');
      });
    });
  });

  // ============================================================================
  // 2. AC-F004-02 / STS-S1-006 (Negative — Inactive Service Exclusion & RBAC)
  // ============================================================================
  describe('2. AC-F004-02 / STS-S1-006 (Negative — Inactive Service Exclusion & RBAC)', () => {
    let inactiveServiceId: string;
    let inactiveServiceName: string;

    beforeAll(async () => {
      inactiveServiceName = `Deactivated Service Test ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: inactiveServiceName,
          description: 'Service to be deactivated.',
          durationMinutes: 60,
        });
      expect(res.status).toBe(201);
      inactiveServiceId = res.body.data.serviceId;
      createdServiceIds.push(inactiveServiceId);

      // Admin updates the service status to INACTIVE via PATCH /api/v1/admin/services/:serviceId/status (200 OK)
      const patchRes = await request(app)
        .patch(`/api/v1/admin/services/${inactiveServiceId}/status`)
        .set('Cookie', adminCookies)
        .send({ serviceStatus: 'INACTIVE' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.success).toBe(true);
      expect(patchRes.body.data.serviceStatus).toBe('INACTIVE');
    });

    it('When Patient calls GET /api/v1/services, the inactive service must be hidden from list (FR-018, BR-004)', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('Cookie', patientCookies);

      expect(res.status).toBe(200);
      const found = res.body.data.find((s: any) => s.serviceId === inactiveServiceId);
      expect(found).toBeUndefined();
    });

    it('When Doctor calls GET /api/v1/services, the inactive service must be hidden from list (FR-018, BR-004)', async () => {
      const res = await request(app)
        .get('/api/v1/services')
        .set('Cookie', doctorCookies);

      expect(res.status).toBe(200);
      const found = res.body.data.find((s: any) => s.serviceId === inactiveServiceId);
      expect(found).toBeUndefined();
    });

    it('Admin still sees the inactive service in their list via GET /api/v1/services and GET /api/v1/admin/services', async () => {
      const resServices = await request(app)
        .get('/api/v1/services')
        .set('Cookie', adminCookies);
      expect(resServices.status).toBe(200);
      const foundServices = resServices.body.data.find((s: any) => s.serviceId === inactiveServiceId);
      expect(foundServices).toBeDefined();
      expect(foundServices.serviceStatus).toBe('INACTIVE');

      const resAdminServices = await request(app)
        .get('/api/v1/admin/services')
        .set('Cookie', adminCookies);
      expect(resAdminServices.status).toBe(200);
      const foundAdmin = resAdminServices.body.data.find((s: any) => s.serviceId === inactiveServiceId);
      expect(foundAdmin).toBeDefined();
      expect(foundAdmin.serviceStatus).toBe('INACTIVE');

      const resFilter = await request(app)
        .get('/api/v1/services?status=INACTIVE')
        .set('Cookie', adminCookies);
      expect(resFilter.status).toBe(200);
      const foundFilter = resFilter.body.data.find((s: any) => s.serviceId === inactiveServiceId);
      expect(foundFilter).toBeDefined();
    });

    it('Patient requesting GET /api/v1/services/:inactiveId receives 404 Not Found (Anti-enumeration NFR-004)', async () => {
      const res = await request(app)
        .get(`/api/v1/services/${inactiveServiceId}`)
        .set('Cookie', patientCookies);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SERVICE_NOT_FOUND');
    });

    it('Admin status toggle records AuditLog (SERVICE_STATUS_UPDATED)', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityId: inactiveServiceId,
          actionType: 'SERVICE_STATUS_UPDATED',
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(adminUserId);
      expect(auditLog?.entityType).toBe('MedicalService');
    });

    it('PATIENT attempting to call POST /api/v1/admin/services is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', patientCookies)
        .send({ serviceName: 'Unauthorized Patient Service', durationMinutes: 30 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('DOCTOR attempting to call POST /api/v1/admin/services is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', doctorCookies)
        .send({ serviceName: 'Unauthorized Doctor Service', durationMinutes: 30 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('PATIENT attempting to call PATCH /api/v1/admin/services/:serviceId/status is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/services/${inactiveServiceId}/status`)
        .set('Cookie', patientCookies)
        .send({ serviceStatus: 'ACTIVE' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('DOCTOR attempting to call PATCH /api/v1/admin/services/:serviceId/status is rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/services/${inactiveServiceId}/status`)
        .set('Cookie', doctorCookies)
        .send({ serviceStatus: 'ACTIVE' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
    it('Forbidden attempts have no side effects: nothing is created and the service stays INACTIVE', async () => {
      const created = await prisma.medicalService.count({
        where: { serviceName: { in: ['Unauthorized Patient Service', 'Unauthorized Doctor Service'] } },
      });
      expect(created).toBe(0);

      const stillInactive = await prisma.medicalService.findUnique({
        where: { serviceId: inactiveServiceId },
      });
      expect(stillInactive?.serviceStatus).toBe('INACTIVE');

      // Only the admin's own toggle produced a status-change audit entry.
      const statusAudits = await prisma.auditLog.findMany({
        where: { entityId: inactiveServiceId, actionType: 'SERVICE_STATUS_UPDATED' },
      });
      expect(statusAudits.length).toBe(1);
      expect(statusAudits[0].userId).toBe(adminUserId);
    });
  });

  // ============================================================================
  // 3. AC-F004-03 / STS-S1-006 (Boundary — Duration Limits & Duplicate Name)
  // ============================================================================
  describe('3. AC-F004-03 / STS-S1-006 (Boundary — Duration Limits & Duplicate Name)', () => {
    it('Submitting durationMinutes as 0 is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: `Boundary 0 Test ${Date.now()}`,
          durationMinutes: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Submitting durationMinutes as -15 is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: `Boundary -15 Test ${Date.now()}`,
          durationMinutes: -15,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Submitting durationMinutes as 481 is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: `Boundary 481 Test ${Date.now()}`,
          durationMinutes: 481,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Submitting durationMinutes as 15 succeeds with 201 Created', async () => {
      const name = `Boundary 15 Test ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: name,
          durationMinutes: 15,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.durationMinutes).toBe(15);
      createdServiceIds.push(res.body.data.serviceId);
    });

    it('Submitting durationMinutes as 480 succeeds with 201 Created', async () => {
      const name = `Boundary 480 Test ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: name,
          durationMinutes: 480,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.durationMinutes).toBe(480);
      createdServiceIds.push(res.body.data.serviceId);
    });

    it('Submitting durationMinutes as 1 (minimum allowed boundary) succeeds with 201 Created', async () => {
      const name = `Boundary 1 Test ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: name,
          durationMinutes: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.durationMinutes).toBe(1);
      createdServiceIds.push(res.body.data.serviceId);
    });

    it('Creating a service with a duplicate name returns 409 Conflict (exact and case-insensitive)', async () => {
      const baseName = `Duplicate Target Service ${Date.now()}`;
      const res1 = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: baseName,
          durationMinutes: 30,
        });
      expect(res1.status).toBe(201);
      createdServiceIds.push(res1.body.data.serviceId);

      // Exact duplicate
      const resExact = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: baseName,
          durationMinutes: 45,
        });
      expect(resExact.status).toBe(409);
      expect(resExact.body.error.code).toBe('SERVICE_NAME_EXISTS');

      // Case-insensitive duplicate (lowercase)
      const resCase = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: baseName.toLowerCase(),
          durationMinutes: 45,
        });
      expect(resCase.status).toBe(409);
      expect(resCase.body.error.code).toBe('SERVICE_NAME_EXISTS');
    });

    it('Empty or whitespace serviceName returns 400 Bad Request', async () => {
      const resEmpty = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: '',
          durationMinutes: 30,
        });
      expect(resEmpty.status).toBe(400);

      const resWhitespace = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: '   ',
          durationMinutes: 30,
        });
      expect(resWhitespace.status).toBe(400);
    });

    it('serviceName exceeding 150 characters returns 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: 'S'.repeat(151),
          durationMinutes: 30,
        });
      expect(res.status).toBe(400);
    });

    it('serviceName with exactly 150 characters succeeds (201 Created)', async () => {
      const name150 = 'S'.repeat(140) + Date.now().toString().slice(-10);
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: name150,
          durationMinutes: 30,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.serviceName.length).toBe(150);
      createdServiceIds.push(res.body.data.serviceId);
    });
    it.each([
      ['0', 0],
      ['-15', -15],
      ['481', 481],
      ['a fractional value (45.5)', 45.5],
      ['a non-numeric string', 'abc'],
    ])('a rejected durationMinutes (%s) is not persisted and writes no audit entry', async (_label, value) => {
      const name = `Rejected Duration ${String(_label).replace(/\W+/g, '-')} ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({ serviceName: name, durationMinutes: value });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      expect(await prisma.medicalService.count({ where: { serviceName: name } })).toBe(0);
      const audits = await prisma.auditLog.count({
        where: { actionType: 'SERVICE_CREATED', details: { path: ['serviceName'], equals: name } },
      });
      expect(audits).toBe(0);
    });

    it('a rejected duplicate-name request does not create a second row or audit entry', async () => {
      const name = `Duplicate Side Effect ${Date.now()}`;
      const first = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({ serviceName: name, durationMinutes: 30 });
      expect(first.status).toBe(201);
      createdServiceIds.push(first.body.data.serviceId);

      const dup = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({ serviceName: name.toUpperCase(), durationMinutes: 30 });
      expect(dup.status).toBe(409);

      expect(
        await prisma.medicalService.count({ where: { serviceName: { equals: name, mode: 'insensitive' } } })
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { actionType: 'SERVICE_CREATED', details: { path: ['serviceName'], equals: name.toUpperCase() } },
        })
      ).toBe(0);
    });
  });

  // ============================================================================
  // 4. PUT /api/v1/admin/services/:serviceId (Service Updates)
  // ============================================================================
  describe('4. PUT /api/v1/admin/services/:serviceId (Service Updates)', () => {
    let updateTestServiceId: string;
    let initialName: string;

    beforeAll(async () => {
      initialName = `Update Target ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: initialName,
          description: 'Original description',
          durationMinutes: 30,
        });
      expect(res.status).toBe(201);
      updateTestServiceId = res.body.data.serviceId;
      createdServiceIds.push(updateTestServiceId);
    });

    it('PUT rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/services/${updateTestServiceId}`)
        .send({
          serviceName: 'Updated Name',
          durationMinutes: 45,
        });
      expect(res.status).toBe(401);
    });

    it('PUT rejects PATIENT and DOCTOR roles with 403 Forbidden', async () => {
      const resPatient = await request(app)
        .put(`/api/v1/admin/services/${updateTestServiceId}`)
        .set('Cookie', patientCookies)
        .send({
          serviceName: 'Hacked by Patient',
          durationMinutes: 45,
        });
      expect(resPatient.status).toBe(403);

      const resDoctor = await request(app)
        .put(`/api/v1/admin/services/${updateTestServiceId}`)
        .set('Cookie', doctorCookies)
        .send({
          serviceName: 'Hacked by Doctor',
          durationMinutes: 45,
        });
      expect(resDoctor.status).toBe(403);
    });

    it('PUT returns 404 Not Found for non-existent serviceId', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const res = await request(app)
        .put(`/api/v1/admin/services/${nonExistentId}`)
        .set('Cookie', adminCookies)
        .send({
          serviceName: 'Non-existent service update',
          durationMinutes: 30,
        });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SERVICE_NOT_FOUND');
    });

    it('PUT successfully updates serviceName, description, and durationMinutes (200 OK)', async () => {
      const updatedName = `Updated Service Name ${Date.now()}`;
      const res = await request(app)
        .put(`/api/v1/admin/services/${updateTestServiceId}`)
        .set('Cookie', adminCookies)
        .send({
          serviceName: updatedName,
          description: 'Updated comprehensive description',
          durationMinutes: 60,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.serviceId).toBe(updateTestServiceId);
      expect(res.body.data.serviceName).toBe(updatedName);
      expect(res.body.data.description).toBe('Updated comprehensive description');
      expect(res.body.data.durationMinutes).toBe(60);

      // Verify in DB
      const dbRecord = await prisma.medicalService.findUnique({
        where: { serviceId: updateTestServiceId },
      });
      expect(dbRecord?.serviceName).toBe(updatedName);
      expect(dbRecord?.durationMinutes).toBe(60);
    });

    it('PUT rejects duplicate name conflicting with another existing service with 409 Conflict', async () => {
      const otherName = `Other Target Service ${Date.now()}`;
      const otherRes = await request(app)
        .post('/api/v1/admin/services')
        .set('Cookie', adminCookies)
        .send({
          serviceName: otherName,
          durationMinutes: 20,
        });
      expect(otherRes.status).toBe(201);
      createdServiceIds.push(otherRes.body.data.serviceId);

      // Attempt to rename updateTestService to otherName (case-insensitive)
      const conflictRes = await request(app)
        .put(`/api/v1/admin/services/${updateTestServiceId}`)
        .set('Cookie', adminCookies)
        .send({
          serviceName: otherName.toLowerCase(),
          durationMinutes: 30,
        });
      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe('SERVICE_NAME_EXISTS');
    });

    it('PUT rejects invalid durationMinutes with 400 Bad Request', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/services/${updateTestServiceId}`)
        .set('Cookie', adminCookies)
        .send({
          serviceName: 'Valid Name',
          durationMinutes: 500,
        });
      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // 5. Security & Unauthenticated Access Enforcement
  // ============================================================================
  describe('5. Security & Unauthenticated Access Enforcement', () => {
    it('Unauthenticated GET /api/v1/services returns 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/services');
      expect(res.status).toBe(401);
    });

    it('Unauthenticated POST /api/v1/admin/services returns 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/admin/services')
        .send({ serviceName: 'Unauth Test', durationMinutes: 30 });
      expect(res.status).toBe(401);
    });

    it('Unauthenticated PATCH /api/v1/admin/services/:id/status returns 401 Unauthorized', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/services/00000000-0000-4000-8000-000000000000/status')
        .send({ serviceStatus: 'INACTIVE' });
      expect(res.status).toBe(401);
    });

    it('PATCH returns 404 Not Found for non-existent serviceId', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const res = await request(app)
        .patch(`/api/v1/admin/services/${nonExistentId}/status`)
        .set('Cookie', adminCookies)
        .send({ serviceStatus: 'INACTIVE' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SERVICE_NOT_FOUND');
    });

    it('PATCH rejects invalid status value with 400 Bad Request', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/services/00000000-0000-4000-8000-000000000000/status')
        .set('Cookie', adminCookies)
        .send({ serviceStatus: 'DELETED' });
      expect(res.status).toBe(400);
    });
  });
});
