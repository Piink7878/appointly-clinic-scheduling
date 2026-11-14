// ==============================================================================
// Appointly Server — Doctor-Service Assignment Integration & API Tests (F-005)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 1.5 & 2.5, STS-S1-007;
//            System-Level SDS Sections 3.2E, 5.2, 6
// Acceptance Criteria:
//   - AC-F005-01 (Positive — Assignment & Filtered Retrieval)
//   - AC-F005-02 (Negative — Duplicate Assignment Rejection)
//   - AC-F005-03 (Boundary — Zero Assigned Doctors)
// Every test builds its own doctors/services, so it is independent of seed data.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';

describe('Doctor-Service Assignment (F-005)', () => {
  const validPassword = 'ChangeMe123!';
  const stamp = Date.now();
  const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

  let patientCookies: string[];
  let doctorCookies: string[];
  let adminCookies: string[];
  let adminUserId: string;

  // Fixtures
  let d1: { doctorId: string; email: string }; // ACTIVE
  let d2: { doctorId: string; email: string }; // ACTIVE, never assigned
  let dInactive: { doctorId: string; email: string }; // deactivated before the tests run
  let s1: string; // ACTIVE service
  let s2: string; // ACTIVE service
  let s3: string; // ACTIVE service
  let sEmpty: string; // ACTIVE service, no doctors
  let sInactive: string; // INACTIVE service

  const createdUserEmails: string[] = [];
  const createdServiceIds: string[] = [];
  const createdDoctorIds: string[] = [];

  const login = async (email: string) => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: validPassword });
    expect(res.status).toBe(200);
    return res;
  };

  const createDoctor = async (label: string) => {
    const email = `f005.${label}.${stamp}@appointly.local`;
    const res = await request(app)
      .post('/api/v1/admin/doctors')
      .set('Cookie', adminCookies)
      .send({
        email,
        password: validPassword,
        fullName: `Dr. F005 ${label}`,
        specialization: 'Assignment Testing',
      });
    expect(res.status).toBe(201);
    createdUserEmails.push(email);
    createdDoctorIds.push(res.body.data.doctorId);
    return { doctorId: res.body.data.doctorId as string, email };
  };

  const createService = async (label: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') => {
    const service = await prisma.medicalService.create({
      data: {
        serviceName: `F005 ${label} ${stamp}`,
        durationMinutes: 20,
        serviceStatus: status,
      },
    });
    createdServiceIds.push(service.serviceId);
    return service.serviceId;
  };

  const assign = (doctorId: string, body: unknown, cookies: string[] = adminCookies) =>
    request(app).post(`/api/v1/admin/doctors/${doctorId}/services`).set('Cookie', cookies).send(body as object);

  const unassign = (doctorId: string, serviceId: string, cookies: string[] = adminCookies) =>
    request(app).delete(`/api/v1/admin/doctors/${doctorId}/services/${serviceId}`).set('Cookie', cookies);

  const listFor = (serviceId: string, cookies: string[]) =>
    request(app).get(`/api/v1/doctors?serviceId=${serviceId}`).set('Cookie', cookies);

  const idsOf = (res: request.Response): string[] => res.body.data.map((d: any) => d.doctorId);

  const countAssignments = (doctorId: string, serviceId?: string) =>
    prisma.doctorService.count({ where: { doctorId, ...(serviceId ? { serviceId } : {}) } });

  beforeAll(async () => {
    patientCookies = (await login('patient.arisa@appointly.local')).headers['set-cookie'];
    doctorCookies = (await login('doctor@appointly.local')).headers['set-cookie'];
    const adminLogin = await login('admin@appointly.local');
    adminCookies = adminLogin.headers['set-cookie'];
    adminUserId = adminLogin.body.data.userId;

    d1 = await createDoctor('d1');
    d2 = await createDoctor('d2');
    dInactive = await createDoctor('inactive');
    const deactivate = await request(app)
      .patch(`/api/v1/admin/doctors/${dInactive.doctorId}/status`)
      .set('Cookie', adminCookies)
      .send({ profileStatus: 'INACTIVE' });
    expect(deactivate.status).toBe(200);

    s1 = await createService('S1');
    s2 = await createService('S2');
    s3 = await createService('S3');
    sEmpty = await createService('Empty');
    sInactive = await createService('Inactive', 'INACTIVE');
  });

  afterAll(async () => {
    const doctorServiceIds = (
      await prisma.doctorService.findMany({
        where: { OR: [{ doctorId: { in: createdDoctorIds } }, { serviceId: { in: createdServiceIds } }] },
        select: { doctorServiceId: true },
      })
    ).map((ds) => ds.doctorServiceId);

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: [...createdDoctorIds, ...createdServiceIds, ...doctorServiceIds] } },
          ...createdDoctorIds.map((id) => ({ details: { path: ['doctorId'], equals: id } })),
        ],
      },
    });
    await prisma.doctorService.deleteMany({
      where: { OR: [{ doctorId: { in: createdDoctorIds } }, { serviceId: { in: createdServiceIds } }] },
    });
    await prisma.medicalService.deleteMany({ where: { serviceId: { in: createdServiceIds } } });
    await prisma.user.deleteMany({ where: { email: { in: createdUserEmails } } });
  });

  // ============================================================================
  // 1. AC-F005-01 / STS-S1-007 (Positive — Assignment & Filtered Retrieval)
  // ============================================================================
  describe('1. AC-F005-01 (Positive — Assignment & Filtered Retrieval)', () => {
    it('POST /admin/doctors/:id/services assigns a service (201), persists the row and writes a DOCTOR_SERVICE_ASSIGNED audit entry', async () => {
      const res = await assign(d1.doctorId, { serviceId: s1 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.doctorId).toBe(d1.doctorId);
      expect(res.body.data.serviceId).toBe(s1);

      const row = await prisma.doctorService.findUnique({
        where: { doctorId_serviceId: { doctorId: d1.doctorId, serviceId: s1 } },
      });
      expect(row).not.toBeNull();

      const audit = await prisma.auditLog.findFirst({
        where: { actionType: 'DOCTOR_SERVICE_ASSIGNED', entityId: row!.doctorServiceId },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUserId);
      expect(audit?.entityType).toBe('DoctorService');
      expect(audit?.details).toMatchObject({ doctorId: d1.doctorId, serviceId: s1 });
    });

    it('GET /doctors?serviceId=S1 returns the assigned doctor and excludes unassigned ones (PATIENT)', async () => {
      const res = await listFor(s1, patientCookies);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(idsOf(res)).toContain(d1.doctorId);
      expect(idsOf(res)).not.toContain(d2.doctorId);
    });

    it('DOCTOR role receives the same filtered list', async () => {
      const res = await listFor(s1, doctorCookies);
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([d1.doctorId]);
    });

    it('the filtered list for patients exposes only public doctor fields', async () => {
      const res = await listFor(s1, patientCookies);
      const doc = res.body.data.find((d: any) => d.doctorId === d1.doctorId);
      for (const field of ['email', 'userId', 'professionalLicenseNumber', 'accountStatus', 'user']) {
        expect(doc).not.toHaveProperty(field);
      }
      expect(doc.services.map((s: any) => s.serviceId)).toContain(s1);
    });

    it('a doctor can be assigned several services and each filter returns that doctor', async () => {
      expect((await assign(d1.doctorId, { serviceId: s2 })).status).toBe(201);
      expect(idsOf(await listFor(s1, patientCookies))).toContain(d1.doctorId);
      expect(idsOf(await listFor(s2, patientCookies))).toContain(d1.doctorId);
    });

    it('batch form { serviceIds } assigns several services at once (201) with one audit entry each', async () => {
      const res = await assign(d2.doctorId, { serviceIds: [s1, s2, s1] }); // duplicate ids in the list are collapsed
      expect(res.status).toBe(201);
      expect(res.body.data.doctorId).toBe(d2.doctorId);
      expect(res.body.data.assignments).toHaveLength(2);
      expect(await countAssignments(d2.doctorId)).toBe(2);

      const audits = await prisma.auditLog.count({
        where: {
          actionType: 'DOCTOR_SERVICE_ASSIGNED',
          entityId: { in: res.body.data.assignments.map((a: any) => a.doctorServiceId) },
        },
      });
      expect(audits).toBe(2);
    });

    it('DELETE /admin/doctors/:id/services/:serviceId unassigns (200), removes the row and writes a DOCTOR_SERVICE_UNASSIGNED audit entry', async () => {
      const before = await prisma.doctorService.findUnique({
        where: { doctorId_serviceId: { doctorId: d2.doctorId, serviceId: s2 } },
      });
      expect(before).not.toBeNull();

      const res = await unassign(d2.doctorId, s2);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      expect(await countAssignments(d2.doctorId, s2)).toBe(0);
      const audit = await prisma.auditLog.findFirst({
        where: { actionType: 'DOCTOR_SERVICE_UNASSIGNED', entityId: before!.doctorServiceId },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUserId);
      expect(audit?.details).toMatchObject({ doctorId: d2.doctorId, serviceId: s2 });

      // The unassigned doctor disappears from that service's filter, but keeps S1.
      expect(idsOf(await listFor(s2, patientCookies))).not.toContain(d2.doctorId);
      expect(idsOf(await listFor(s1, patientCookies))).toContain(d2.doctorId);
    });
  });

  // ============================================================================
  // 2. AC-F005-02 / STS-S1-007 (Negative — Duplicates, Missing Resources, RBAC)
  // ============================================================================
  describe('2. AC-F005-02 (Negative — Duplicate Assignment, Missing Resources & RBAC)', () => {
    it('re-submitting an existing (doctor, service) pair returns 409 DUPLICATE_ASSIGNMENT without a second row or audit entry', async () => {
      const auditsBefore = await prisma.auditLog.count({
        where: { actionType: 'DOCTOR_SERVICE_ASSIGNED', details: { path: ['doctorId'], equals: d1.doctorId } },
      });

      const res = await assign(d1.doctorId, { serviceId: s1 });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_ASSIGNMENT');

      expect(await countAssignments(d1.doctorId, s1)).toBe(1);
      const auditsAfter = await prisma.auditLog.count({
        where: { actionType: 'DOCTOR_SERVICE_ASSIGNED', details: { path: ['doctorId'], equals: d1.doctorId } },
      });
      expect(auditsAfter).toBe(auditsBefore);
    });

    it('two concurrent identical requests: exactly one 201 and one 409 (database UNIQUE constraint / P2002)', async () => {
      const [a, b] = await Promise.all([
        assign(d2.doctorId, { serviceId: s3 }),
        assign(d2.doctorId, { serviceId: s3 }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const conflict = a.status === 409 ? a : b;
      expect(conflict.body.error.code).toBe('DUPLICATE_ASSIGNMENT');
      expect(await countAssignments(d2.doctorId, s3)).toBe(1);

      await unassign(d2.doctorId, s3); // keep d2's assignments predictable
    });

    it('a batch containing an already-assigned service fails with 409 and assigns nothing (atomic)', async () => {
      // d1 already has s1. s3 is new for d1, so a non-atomic implementation would leave it behind.
      const res = await assign(d1.doctorId, { serviceIds: [s3, s1] });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_ASSIGNMENT');
      expect(await countAssignments(d1.doctorId, s3)).toBe(0);
      expect(
        await prisma.auditLog.count({
          where: {
            actionType: 'DOCTOR_SERVICE_ASSIGNED',
            AND: [
              { details: { path: ['doctorId'], equals: d1.doctorId } },
              { details: { path: ['serviceId'], equals: s3 } },
            ],
          },
        })
      ).toBe(0);
    });

    it('a batch containing an unknown service fails with 404 and assigns nothing', async () => {
      const res = await assign(d1.doctorId, { serviceIds: [s3, UNKNOWN_UUID] });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SERVICE_NOT_FOUND');
      expect(await countAssignments(d1.doctorId, s3)).toBe(0);
    });

    it('unknown doctorId (valid UUID) returns 404 DOCTOR_NOT_FOUND', async () => {
      const res = await assign(UNKNOWN_UUID, { serviceId: s1 });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });

    it('malformed doctorId returns 404 DOCTOR_NOT_FOUND', async () => {
      const res = await assign('not-a-uuid', { serviceId: s1 });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCTOR_NOT_FOUND');
    });

    it('unknown serviceId (valid UUID) returns 404 SERVICE_NOT_FOUND and creates nothing', async () => {
      const res = await assign(d1.doctorId, { serviceId: UNKNOWN_UUID });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SERVICE_NOT_FOUND');
    });

    it.each([
      ['a malformed serviceId', { serviceId: 'nope' }],
      ['a missing serviceId', {}],
      ['both serviceId and serviceIds', { serviceId: 'a', serviceIds: ['b'] }],
      ['an empty serviceIds list', { serviceIds: [] }],
      ['a malformed entry in serviceIds', { serviceIds: ['nope'] }],
    ])('%s returns 400 VALIDATION_ERROR', async (_label, body) => {
      const res = await assign(d1.doctorId, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('DELETE of a pair that is not assigned returns 404 ASSIGNMENT_NOT_FOUND and writes no audit entry', async () => {
      const before = await prisma.auditLog.count({ where: { actionType: 'DOCTOR_SERVICE_UNASSIGNED' } });

      const res = await unassign(d1.doctorId, sEmpty);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ASSIGNMENT_NOT_FOUND');

      const malformed = await unassign('not-a-uuid', sEmpty);
      expect(malformed.status).toBe(404);

      expect(await prisma.auditLog.count({ where: { actionType: 'DOCTOR_SERVICE_UNASSIGNED' } })).toBe(before);
    });

    it.each([
      ['PATIENT', () => patientCookies],
      ['DOCTOR', () => doctorCookies],
    ])('%s cannot assign or unassign (403) and nothing changes', async (_role, cookies) => {
      const post = await assign(d2.doctorId, { serviceId: sEmpty }, cookies());
      expect(post.status).toBe(403);
      expect(post.body.error.code).toBe('FORBIDDEN');

      const del = await unassign(d1.doctorId, s1, cookies());
      expect(del.status).toBe(403);

      expect(await countAssignments(d2.doctorId, sEmpty)).toBe(0);
      expect(await countAssignments(d1.doctorId, s1)).toBe(1);
    });

    it('unauthenticated requests return 401', async () => {
      const post = await request(app)
        .post(`/api/v1/admin/doctors/${d1.doctorId}/services`)
        .send({ serviceId: s1 });
      expect(post.status).toBe(401);

      const del = await request(app).delete(`/api/v1/admin/doctors/${d1.doctorId}/services/${s1}`);
      expect(del.status).toBe(401);

      const list = await request(app).get(`/api/v1/doctors?serviceId=${s1}`);
      expect(list.status).toBe(401);
    });
  });

  // ============================================================================
  // 3. AC-F005-03 / STS-S1-007 (Boundary — Zero Doctors, Inactive Doctor/Service)
  // ============================================================================
  describe('3. AC-F005-03 (Boundary — Zero Assigned Doctors, Inactive Doctor / Service)', () => {
    it('an ACTIVE service with no assigned doctors returns 200 with [] (PATIENT and DOCTOR)', async () => {
      for (const cookies of [patientCookies, doctorCookies]) {
        const res = await listFor(sEmpty, cookies);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
      }
    });

    it('an unknown or malformed serviceId returns 200 with []', async () => {
      for (const id of [UNKNOWN_UUID, 'not-a-uuid']) {
        const res = await listFor(id, patientCookies);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
      }
    });

    it('an INACTIVE doctor assigned to the service is hidden from PATIENT/DOCTOR but visible to ADMIN', async () => {
      expect((await assign(dInactive.doctorId, { serviceId: s1 })).status).toBe(201);

      for (const cookies of [patientCookies, doctorCookies]) {
        expect(idsOf(await listFor(s1, cookies))).not.toContain(dInactive.doctorId);
      }
      const adminRes = await listFor(s1, adminCookies);
      expect(adminRes.status).toBe(200);
      expect(idsOf(adminRes)).toContain(dInactive.doctorId);
      expect(idsOf(adminRes)).toContain(d1.doctorId);
    });

    it('an INACTIVE service returns [] for PATIENT/DOCTOR even when doctors are assigned, while ADMIN still sees them (BR-002)', async () => {
      expect((await assign(d1.doctorId, { serviceId: sInactive })).status).toBe(201);

      for (const cookies of [patientCookies, doctorCookies]) {
        const res = await listFor(sInactive, cookies);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
      }
      const adminRes = await listFor(sInactive, adminCookies);
      expect(adminRes.status).toBe(200);
      expect(idsOf(adminRes)).toEqual([d1.doctorId]);
    });

    it('deactivating a service after assignment hides its doctors from patients; reactivating restores them', async () => {
      await prisma.medicalService.update({ where: { serviceId: s2 }, data: { serviceStatus: 'INACTIVE' } });
      expect((await listFor(s2, patientCookies)).body.data).toEqual([]);

      await prisma.medicalService.update({ where: { serviceId: s2 }, data: { serviceStatus: 'ACTIVE' } });
      expect(idsOf(await listFor(s2, patientCookies))).toContain(d1.doctorId);
    });

    it('ADMIN filtered list can be narrowed further with ?status=', async () => {
      const res = await request(app)
        .get(`/api/v1/doctors?serviceId=${s1}&status=INACTIVE`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([dInactive.doctorId]);
    });

    it('deleting a doctor-service pair leaves the doctor and the service themselves intact', async () => {
      const res = await unassign(d1.doctorId, sInactive);
      expect(res.status).toBe(200);
      expect(await prisma.doctor.findUnique({ where: { doctorId: d1.doctorId } })).not.toBeNull();
      expect(await prisma.medicalService.findUnique({ where: { serviceId: sInactive } })).not.toBeNull();
    });
  });
});
