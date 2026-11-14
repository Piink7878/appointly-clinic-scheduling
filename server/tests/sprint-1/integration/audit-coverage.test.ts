// ==============================================================================
// Appointly Server — AuditLog Coverage for Administrative Actions (F-003 … F-007)
// ==============================================================================
// Reference: System-Level SDS Sections 3.2L & 7.3; Sprint 1 Contracts AC-F003-02,
//            AC-F004-02, AC-F005-01, AC-F007-01
// Every state-changing administrative action writes EXACTLY ONE AuditLog row naming
// the acting administrator; failed or no-op requests write none.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/shared/database';
import { cookiesOf } from '../helpers';

describe('AuditLog coverage for administrative actions', () => {
  const stamp = Date.now();
  let adminCookies: string[];
  let adminUserId: string;

  let doctorId: string;
  let doctorEmail: string;
  let serviceId: string;
  let secondServiceId: string;
  let startedAt: Date;
  const entityIds: string[] = [];

  const admin = {
    post: (url: string, body: object) => request(app).post(`/api/v1${url}`).set('Cookie', adminCookies).send(body),
    put: (url: string, body: object) => request(app).put(`/api/v1${url}`).set('Cookie', adminCookies).send(body),
    patch: (url: string, body: object) => request(app).patch(`/api/v1${url}`).set('Cookie', adminCookies).send(body),
    del: (url: string) => request(app).delete(`/api/v1${url}`).set('Cookie', adminCookies),
  };

  /** Audit rows written by this test run for one entity. */
  const rowsFor = (entityId: string) =>
    prisma.auditLog.findMany({ where: { entityId, createdAt: { gte: startedAt } }, orderBy: { createdAt: 'asc' } });

  const actionsFor = async (entityId: string) => (await rowsFor(entityId)).map((r) => r.actionType);

  beforeAll(async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@appointly.local', password: 'ChangeMe123!' });
    adminCookies = cookiesOf(login);
    adminUserId = login.body.data.userId;
    startedAt = new Date();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds }, createdAt: { gte: startedAt } } });
    await prisma.doctorService.deleteMany({ where: { OR: [{ doctorId }, { serviceId: { in: [serviceId, secondServiceId] } }] } });
    await prisma.medicalService.deleteMany({ where: { serviceId: { in: [serviceId, secondServiceId] } } });
    await prisma.user.deleteMany({ where: { email: doctorEmail } });
  });

  describe('F-003 doctors', () => {
    it('create writes DOCTOR_CREATED once, naming the admin', async () => {
      doctorEmail = `audit.cov.${stamp}@appointly.local`;
      const res = await admin.post('/admin/doctors', {
        email: doctorEmail,
        password: 'ChangeMe123!',
        fullName: 'Dr. Audit Coverage',
        specialization: 'Auditing',
      });
      expect(res.status).toBe(201);
      doctorId = res.body.data.doctorId;
      entityIds.push(doctorId);

      const rows = await rowsFor(doctorId);
      expect(rows.map((r) => r.actionType)).toEqual(['DOCTOR_CREATED']);
      expect(rows[0].userId).toBe(adminUserId);
    });

    it('a real edit writes DOCTOR_PROFILE_UPDATED once with previous and current values', async () => {
      const res = await admin.put(`/admin/doctors/${doctorId}`, {
        fullName: 'Dr. Audit Coverage',
        specialization: 'Internal Auditing',
        professionalLicenseNumber: 'LIC-AUDIT-1',
      });
      expect(res.status).toBe(200);

      const rows = (await rowsFor(doctorId)).filter((r) => r.actionType === 'DOCTOR_PROFILE_UPDATED');
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(adminUserId);
      expect(rows[0].details).toMatchObject({
        previous: { specialization: 'Auditing', professionalLicenseNumber: null },
        current: { specialization: 'Internal Auditing', professionalLicenseNumber: 'LIC-AUDIT-1' },
      });
    });

    it('an edit that changes nothing writes no audit row', async () => {
      const before = (await actionsFor(doctorId)).length;
      const res = await admin.put(`/admin/doctors/${doctorId}`, {
        fullName: 'Dr. Audit Coverage',
        specialization: 'Internal Auditing',
        professionalLicenseNumber: 'LIC-AUDIT-1',
      });
      expect(res.status).toBe(200);
      expect((await actionsFor(doctorId)).length).toBe(before);
    });

    it('a rejected edit (validation / unknown doctor) writes no audit row', async () => {
      const before = (await actionsFor(doctorId)).length;
      expect((await admin.put(`/admin/doctors/${doctorId}`, { fullName: '', specialization: 'x' })).status).toBe(400);
      expect(
        (await admin.put('/admin/doctors/00000000-0000-4000-8000-000000000000', { fullName: 'a', specialization: 'b' })).status
      ).toBe(404);
      expect((await actionsFor(doctorId)).length).toBe(before);
    });

    it('status change writes DOCTOR_STATUS_UPDATED once', async () => {
      const res = await admin.patch(`/admin/doctors/${doctorId}/status`, { profileStatus: 'INACTIVE' });
      expect(res.status).toBe(200);
      const rows = (await rowsFor(doctorId)).filter((r) => r.actionType === 'DOCTOR_STATUS_UPDATED');
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(adminUserId);
      await admin.patch(`/admin/doctors/${doctorId}/status`, { profileStatus: 'ACTIVE' });
    });
  });

  describe('F-004 services', () => {
    it('create writes SERVICE_CREATED once', async () => {
      const res = await admin.post('/admin/services', { serviceName: `Audit Service ${stamp}`, durationMinutes: 20 });
      expect(res.status).toBe(201);
      serviceId = res.body.data.serviceId;
      entityIds.push(serviceId);
      const rows = await rowsFor(serviceId);
      expect(rows.map((r) => r.actionType)).toEqual(['SERVICE_CREATED']);
      expect(rows[0].userId).toBe(adminUserId);
    });

    it('a real edit writes SERVICE_UPDATED once with previous and current values', async () => {
      const res = await admin.put(`/admin/services/${serviceId}`, {
        serviceName: `Audit Service ${stamp}`,
        description: 'Now with a description',
        durationMinutes: 45,
      });
      expect(res.status).toBe(200);
      const rows = (await rowsFor(serviceId)).filter((r) => r.actionType === 'SERVICE_UPDATED');
      expect(rows).toHaveLength(1);
      expect(rows[0].details).toMatchObject({
        previous: { durationMinutes: 20, description: null },
        current: { durationMinutes: 45, description: 'Now with a description' },
      });
    });

    it('an unchanged edit or a rejected edit (duration 0, duplicate name) writes nothing', async () => {
      const before = (await actionsFor(serviceId)).length;
      expect(
        (await admin.put(`/admin/services/${serviceId}`, { serviceName: `Audit Service ${stamp}`, description: 'Now with a description', durationMinutes: 45 })).status
      ).toBe(200);
      expect((await admin.put(`/admin/services/${serviceId}`, { serviceName: 'x', durationMinutes: 0 })).status).toBe(400);

      const other = await admin.post('/admin/services', { serviceName: `Audit Service B ${stamp}`, durationMinutes: 10 });
      expect(other.status).toBe(201);
      secondServiceId = other.body.data.serviceId;
      entityIds.push(secondServiceId);
      const dup = await admin.put(`/admin/services/${secondServiceId}`, { serviceName: `Audit Service ${stamp}`, durationMinutes: 10 });
      expect(dup.status).toBe(409);
      expect(dup.body.error.code).toBe('SERVICE_NAME_EXISTS');

      expect((await actionsFor(serviceId)).length).toBe(before);
      expect(await actionsFor(secondServiceId)).toEqual(['SERVICE_CREATED']);
    });

    it('status change writes SERVICE_STATUS_UPDATED once', async () => {
      expect((await admin.patch(`/admin/services/${serviceId}/status`, { serviceStatus: 'INACTIVE' })).status).toBe(200);
      const rows = (await rowsFor(serviceId)).filter((r) => r.actionType === 'SERVICE_STATUS_UPDATED');
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(adminUserId);
    });
  });

  describe('F-005 doctor-service assignment', () => {
    it('assign writes DOCTOR_SERVICE_ASSIGNED once and unassign writes DOCTOR_SERVICE_UNASSIGNED once', async () => {
      const assigned = await admin.post(`/admin/doctors/${doctorId}/services`, { serviceId });
      expect(assigned.status).toBe(201);
      const assignmentId = assigned.body.data.doctorServiceId as string;
      entityIds.push(assignmentId);

      expect((await rowsFor(assignmentId)).map((r) => r.actionType)).toEqual(['DOCTOR_SERVICE_ASSIGNED']);

      expect((await admin.post(`/admin/doctors/${doctorId}/services`, { serviceId })).status).toBe(409);
      expect((await actionsFor(assignmentId)).length).toBe(1); // the rejected duplicate wrote nothing

      expect((await admin.del(`/admin/doctors/${doctorId}/services/${serviceId}`)).status).toBe(200);
      const rows = await rowsFor(assignmentId);
      expect(rows.map((r) => r.actionType)).toEqual(['DOCTOR_SERVICE_ASSIGNED', 'DOCTOR_SERVICE_UNASSIGNED']);
      expect(rows.every((r) => r.userId === adminUserId)).toBe(true);
    });
  });

  describe('F-007 settings', () => {
    it('a PATCH that changes nothing — including cutoff 0 sent again — writes no audit row', async () => {
      const current = await prisma.clinicSetting.findFirstOrThrow();
      entityIds.push(current.settingId);
      const original = current.cancellationCutoffHours;
      try {
        const first = await admin.patch('/admin/settings', { cancellationCutoffHours: 0 });
        expect(first.status).toBe(200);
        expect(first.body.data.cancellationCutoffHours).toBe(0);
        const afterFirst = (await rowsFor(current.settingId)).length;

        const again = await admin.patch('/admin/settings', { cancellationCutoffHours: 0 });
        expect(again.status).toBe(200);
        expect(again.body.data.cancellationCutoffHours).toBe(0);

        const empty = await admin.patch('/admin/settings', {});
        expect(empty.status).toBe(200);

        expect((await rowsFor(current.settingId)).length).toBe(afterFirst);
      } finally {
        await prisma.clinicSetting.update({ where: { settingId: current.settingId }, data: { cancellationCutoffHours: original } });
      }
    });
  });
});
