// ==============================================================================
// Appointly — Sprint 1 End-to-End Journeys (Playwright)
// ==============================================================================
// Reference: Sprint 1 Contracts Sections 2 & 3 — AC-F001-01/03, AC-F002-01, AC-F003-01,
//            AC-F004-01, AC-F005-01, AC-F006-01/02, AC-F007-01; STS-S1-001…009
//
// Real browser → real API → real, seeded PostgreSQL.
// The journeys change real data, so each one puts it back in `afterEach` / `afterAll`
// hooks (which Playwright runs even when a test fails or times out). The suite can
// therefore be re-run against the same database.
// ==============================================================================

import { test, expect, type Page } from '@playwright/test';
import { ACCOUNTS, DAY_NAMES, openDb, signIn, type Db } from './support';

interface Shift {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const stamp = () => Date.now();

/** The `data` of an API endpoint, called with the page's signed-in session. */
async function getJson(page: Page, url: string) {
  const res = await page.request.get(url);
  expect(res.ok(), `GET ${url} -> ${res.status()}`).toBe(true);
  return (await res.json()).data;
}

// ==============================================================================
// Journey 1 — Auth, RBAC & Patient Profile (F-001, F-002)
// ==============================================================================
test.describe('Journey 1 — Auth, RBAC & Patient Profile (F-001, F-002)', () => {
  test.describe.configure({ mode: 'serial' });

  let db: Db;
  let patientBefore: { patientId: string; fullName: string; phoneNumber: string; dateOfBirth: Date | null };

  test.beforeAll(async () => {
    db = openDb();
    patientBefore = await db.patient.findFirst({ where: { user: { email: ACCOUNTS.patient } } });
  });

  test.afterAll(async () => {
    await db.patient.update({
      where: { patientId: patientBefore.patientId },
      data: {
        fullName: patientBefore.fullName,
        phoneNumber: patientBefore.phoneNumber,
        dateOfBirth: patientBefore.dateOfBirth,
      },
    });
    await db.$disconnect();
  });

  const portals = [
    { role: 'ADMIN', email: ACCOUNTS.admin, landing: '/admin/doctors', badge: 'Clinic Admin', heading: 'Doctor Management' },
    { role: 'DOCTOR', email: ACCOUNTS.doctor, landing: '/doctor/schedule', badge: 'Doctor Portal', heading: 'My Schedule' },
    { role: 'PATIENT', email: ACCOUNTS.patient, landing: '/patient/services', badge: 'Patient Portal', heading: 'Our Services' },
  ] as const;

  for (const portal of portals) {
    test(`${portal.role} signs in with the seeded account and lands in their own portal`, async ({ page }) => {
      await signIn(page, portal.email);

      await expect(page).toHaveURL(new RegExp(`${portal.landing}$`));
      await expect(page.getByText(portal.badge, { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: portal.heading })).toBeVisible();
      await expect(page.getByText(portal.email, { exact: true })).toBeVisible();

      // The session is real: the API knows who we are…
      const me = await getJson(page, '/api/v1/auth/me');
      expect(me.role).toBe(portal.role);
      expect(me.email).toBe(portal.email);

      // …and signing out ends it.
      await page.getByRole('button', { name: 'Log out' }).click();
      await expect(page).toHaveURL(/\/login$/);
      expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
    });
  }

  test('a wrong password is rejected with a clear message and no session', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(ACCOUNTS.patient);
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
  });

  test('RBAC: an unauthenticated visitor opening /admin/doctors is sent to /login', async ({ page }) => {
    await page.goto('/admin/doctors');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Doctor Management' })).toHaveCount(0);
  });

  test('RBAC: a PATIENT opening /admin/doctors is blocked and redirected away', async ({ page }) => {
    await signIn(page, ACCOUNTS.patient);

    await page.goto('/admin/doctors');

    // client route guard
    await expect(page).toHaveURL(/\/unauthorized$/);
    await expect(page.getByText('403 — Access Denied')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Doctor Management' })).toHaveCount(0);

    // server RBAC is authoritative: the data itself is refused too (AC-F001-03)
    const adminApi = await page.request.get('/api/v1/admin/doctors');
    expect(adminApi.status()).toBe(403);
    expect((await adminApi.json()).error.code).toBe('FORBIDDEN');

    // the way out leads back to the patient's own portal
    await page.getByRole('button', { name: /Go to My Portal/ }).click();
    await expect(page).toHaveURL(/\/patient\/services$/);
  });

  test('a PATIENT edits their own profile and the change is still there after a reload (PostgreSQL)', async ({ page }) => {
    await signIn(page, ACCOUNTS.patient);
    await page.goto('/patient/profile');
    await expect(page.locator('#profile-fullName')).toHaveValue(patientBefore.fullName); // form loaded

    const edited = {
      fullName: `E2E Patient ${stamp()}`,
      phoneNumber: '0898765432',
      dateOfBirth: '1991-02-03',
    };

    await page.locator('#profile-fullName').fill(edited.fullName);
    await page.locator('#profile-phoneNumber').fill(edited.phoneNumber);
    await page.locator('#profile-dateOfBirth').fill(edited.dateOfBirth);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('status')).toContainText('Profile updated successfully');

    // reload: the form is filled from the server again, not from browser state
    await page.reload();
    await expect(page.locator('#profile-fullName')).toHaveValue(edited.fullName);
    await expect(page.locator('#profile-phoneNumber')).toHaveValue(edited.phoneNumber);
    await expect(page.locator('#profile-dateOfBirth')).toHaveValue(edited.dateOfBirth);

    // and the row really is in PostgreSQL
    const row = await db.patient.findFirst({ where: { user: { email: ACCOUNTS.patient } } });
    expect(row.fullName).toBe(edited.fullName);
    expect(row.phoneNumber).toBe(edited.phoneNumber);
    expect(row.dateOfBirth.toISOString().slice(0, 10)).toBe(edited.dateOfBirth);
  });
});

// ==============================================================================
// Journey 2 — Admin Catalog & Doctor-Service Assignment (F-003, F-004, F-005)
// ==============================================================================
test.describe('Journey 2 — Admin Catalog & Doctor-Service Assignment (F-003, F-004, F-005)', () => {
  const serviceName = `E2E Service ${stamp()}`;
  let db: Db;

  test.beforeAll(() => {
    db = openDb();
  });

  test.afterAll(async () => {
    // Remove everything the journey created (service, its assignment and their audit rows).
    const service = await db.medicalService.findFirst({ where: { serviceName } });
    if (service) {
      const links = await db.doctorService.findMany({ where: { serviceId: service.serviceId } });
      await db.auditLog.deleteMany({
        where: { entityId: { in: [service.serviceId, ...links.map((l: { doctorServiceId: string }) => l.doctorServiceId)] } },
      });
      await db.doctorService.deleteMany({ where: { serviceId: service.serviceId } });
      await db.medicalService.delete({ where: { serviceId: service.serviceId } });
    }
    await db.$disconnect();
  });

  test('ADMIN creates a service and assigns it to an ACTIVE doctor; a PATIENT sees only that doctor for it', async ({
    page,
    browser,
  }) => {
    // The ACTIVE doctor who gets the service, and every OTHER active doctor (who must not be listed for it).
    // Names come from the database: the seed has several near-identical "Dr. Somchai Prasert …" doctors.
    const assignee = await db.doctor.findFirst({
      where: { user: { email: ACCOUNTS.doctor, accountStatus: 'ACTIVE' }, profileStatus: 'ACTIVE' },
    });
    expect(assignee, `${ACCOUNTS.doctor} must be an ACTIVE doctor`).not.toBeNull();
    const doctorName: string = assignee.fullName;
    const others: { fullName: string }[] = await db.doctor.findMany({
      where: { profileStatus: 'ACTIVE', user: { accountStatus: 'ACTIVE' }, NOT: { doctorId: assignee.doctorId } },
      select: { fullName: true },
    });
    expect(others.length).toBeGreaterThan(0);

    await test.step('ADMIN creates a new service (F-004)', async () => {
      await signIn(page, ACCOUNTS.admin);
      await page.goto('/admin/services');
      await page.getByRole('button', { name: /Add New Service/ }).click();

      const dialog = page.getByRole('dialog', { name: 'Add New Service' });
      await dialog.getByLabel('Service name').fill(serviceName);
      await dialog.getByLabel('Description').fill('Created by the Sprint 1 end-to-end journey.');
      await dialog.getByLabel('Duration (minutes)').fill('25');
      await dialog.getByRole('button', { name: 'Create Service' }).click();

      await expect(page.getByRole('status')).toContainText('created successfully');
      const row = page.getByRole('row').filter({ hasText: serviceName });
      await expect(row).toContainText('25 mins');
      await expect(row).toContainText('Active');
    });

    await test.step('ADMIN assigns the service to an ACTIVE doctor (F-003 / F-005)', async () => {
      await page.goto('/admin/doctors');
      const doctorRow = page.getByRole('row').filter({ hasText: ACCOUNTS.doctor });
      await expect(doctorRow).toContainText(doctorName);
      await expect(doctorRow).toContainText('Active');

      await page.getByRole('button', { name: `Manage services for ${doctorName}`, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Manage Services' });
      await dialog.getByRole('button', { name: `Assign ${serviceName}` }).click();

      await expect(dialog.getByRole('status')).toContainText(`“${serviceName}” assigned to ${doctorName}`);
      await expect(dialog.getByRole('button', { name: `Unassign ${serviceName}` })).toBeVisible();
      await dialog.getByRole('button', { name: 'Done' }).click();
    });

    await test.step('a PATIENT finds the service and sees only the assigned doctor (F-005)', async () => {
      const patientContext = await browser.newContext();
      const patient = await patientContext.newPage();
      try {
        await signIn(patient, ACCOUNTS.patient);
        await patient.goto('/patient/services');

        await expect(patient.getByRole('heading', { name: serviceName })).toBeVisible();
        await patient.getByRole('link', { name: `View available doctors for ${serviceName}` }).click();

        await expect(patient).toHaveURL(/\/patient\/doctors\?serviceId=/);
        await expect(patient.getByRole('heading', { level: 1, name: 'Find a Doctor' })).toBeVisible();
        await expect(patient.getByLabel('Filter by service').locator('option:checked')).toContainText(serviceName);

        const doctorCards = patient.getByRole('list', { name: 'Doctor list' }).getByRole('heading', { level: 2 });
        await expect(doctorCards).toHaveCount(1);
        await expect(doctorCards.first()).toHaveText(doctorName); // exactly this doctor…
        for (const other of others) {
          // …and none of the other active doctors
          await expect(patient.getByRole('heading', { level: 2, name: other.fullName, exact: true })).toHaveCount(0);
        }

        // the filter is what narrowed the list: without it every active doctor is listed
        await patient.getByLabel('Filter by service').selectOption({ label: 'All services' });
        await expect(doctorCards).toHaveCount(others.length + 1);
      } finally {
        await patientContext.close();
      }
    });
  });
});

// ==============================================================================
// Journey 3 — Doctor Self-Schedule, Overlap Rejection & Clinic Settings (F-006, F-007)
// ==============================================================================
test.describe('Journey 3 — Doctor Self-Schedule, Overlap Rejection & Clinic Settings (F-006, F-007)', () => {
  test.describe.configure({ mode: 'serial' });

  let db: Db;
  let doctorId: string;
  let scheduleBefore: Shift[];
  let settingsBefore: Record<string, unknown> & { settingId: string };
  const startedAt = new Date();

  test.beforeAll(async () => {
    db = openDb();
    const doctor = await db.doctor.findFirst({ where: { user: { email: ACCOUNTS.doctor } } });
    doctorId = doctor.doctorId;
    scheduleBefore = (await db.doctorSchedule.findMany({ where: { doctorId } })).map(
      ({ dayOfWeek, startTime, endTime, isActive }: Shift) => ({ dayOfWeek, startTime, endTime, isActive })
    );
    settingsBefore = await db.clinicSetting.findFirst();
  });

  // Each schedule test starts from, and leaves, the doctor's original shifts.
  test.afterEach(async () => {
    await db.doctorSchedule.deleteMany({ where: { doctorId } });
    await db.doctorSchedule.createMany({ data: scheduleBefore.map((s) => ({ ...s, doctorId })) });
  });

  test.afterAll(async () => {
    const { settingId, clinicName, timezone, fixedStartIntervalMinutes, cancellationCutoffHours, reminderLeadHours, updatedBy } =
      settingsBefore as Record<string, any>;
    await db.clinicSetting.update({
      where: { settingId },
      data: { clinicName, timezone, fixedStartIntervalMinutes, cancellationCutoffHours, reminderLeadHours, updatedBy },
    });
    await db.auditLog.deleteMany({ where: { entityId: settingId, createdAt: { gte: startedAt } } });
    await db.$disconnect();
  });

  /** Weekdays (Saturday first, then Sunday) on which the doctor has no shifts at the moment. */
  const freeDays = (shifts: Shift[]) => [6, 0].filter((day) => !shifts.some((s) => s.dayOfWeek === day));

  test('DOCTOR saves 09:00–12:00 and 13:00–17:00 and the shifts survive a reload', async ({ page }) => {
    await signIn(page, ACCOUNTS.doctor);
    await page.goto('/doctor/schedule');

    const before = await getJson(page, '/api/v1/doctors/me/schedule');
    const [day] = freeDays(before.weeklySchedules);
    expect(day, 'a weekday with no shifts is needed (Saturday or Sunday)').toBeDefined();
    const dayName = DAY_NAMES[day];

    await expect(page.getByRole('heading', { level: 3, name: dayName })).toBeVisible();
    await page.getByRole('button', { name: `Add time slot for ${dayName}` }).click();
    await page.getByRole('button', { name: `Add time slot for ${dayName}` }).click();

    await page.getByLabel(`${dayName} slot 1 start time`).fill('09:00');
    await page.getByLabel(`${dayName} slot 1 end time`).fill('12:00');
    await page.getByLabel(`${dayName} slot 2 start time`).fill('13:00');
    await page.getByLabel(`${dayName} slot 2 end time`).fill('17:00');
    await page.getByRole('button', { name: 'Save Schedule' }).click();

    await expect(page.getByRole('status')).toContainText('saved successfully');

    // reload: everything comes back from the server
    await page.reload();
    await expect(page.getByLabel(`${dayName} slot 1 start time`)).toHaveValue('09:00');
    await expect(page.getByLabel(`${dayName} slot 1 end time`)).toHaveValue('12:00');
    await expect(page.getByLabel(`${dayName} slot 2 start time`)).toHaveValue('13:00');
    await expect(page.getByLabel(`${dayName} slot 2 end time`)).toHaveValue('17:00');
    // the days that already had shifts were not disturbed
    await expect(page.getByLabel('Monday slot 1 start time')).toHaveValue('09:00');

    // and the rows are in PostgreSQL
    const rows = await db.doctorSchedule.findMany({ where: { doctorId, dayOfWeek: day }, orderBy: { startTime: 'asc' } });
    expect(rows.map((r: { startTime: string; endTime: string }) => `${r.startTime.slice(0, 5)}-${r.endTime.slice(0, 5)}`)).toEqual([
      '09:00-12:00',
      '13:00-17:00',
    ]);
  });

  test('DOCTOR entering overlapping windows (09:00–13:00 + 12:00–16:00) is told so and nothing is saved', async ({ page }) => {
    await signIn(page, ACCOUNTS.doctor);
    await page.goto('/doctor/schedule');

    const before = await getJson(page, '/api/v1/doctors/me/schedule');
    const [day] = freeDays(before.weeklySchedules);
    expect(day, 'a weekday with no shifts is needed (Saturday or Sunday)').toBeDefined();
    const dayName = DAY_NAMES[day];
    const countRows = () => db.doctorSchedule.count({ where: { doctorId } });
    const rowsBefore = await countRows();

    await expect(page.getByRole('heading', { level: 3, name: dayName })).toBeVisible();
    await page.getByRole('button', { name: `Add time slot for ${dayName}` }).click();
    await page.getByRole('button', { name: `Add time slot for ${dayName}` }).click();
    await page.getByLabel(`${dayName} slot 1 start time`).fill('09:00');
    await page.getByLabel(`${dayName} slot 1 end time`).fill('13:00');
    await page.getByLabel(`${dayName} slot 2 start time`).fill('12:00');
    await page.getByLabel(`${dayName} slot 2 end time`).fill('16:00');
    await page.getByRole('button', { name: 'Save Schedule' }).click();

    // the UI explains what is wrong, on the row and as a banner
    await expect(page.getByText('Overlaps with 09:00–13:00')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Fix 1 time slot');
    await expect(page.getByRole('status')).toHaveCount(0); // no success toast

    // nothing was saved: reload shows an untouched day, and the database agrees
    await page.reload();
    await expect(page.getByLabel(`${dayName} slot 1 start time`)).toHaveCount(0);
    expect(await countRows()).toBe(rowsBefore);

    // The server enforces the same rule on its own (422), even if a client skips the check.
    const direct = await page.request.put('/api/v1/doctors/me/schedule', {
      data: {
        shifts: [
          { dayOfWeek: day, startTime: '09:00', endTime: '13:00', isActive: true },
          { dayOfWeek: day, startTime: '12:00', endTime: '16:00', isActive: true },
        ],
      },
    });
    expect(direct.status()).toBe(422);
    expect((await direct.json()).error.code).toBe('INVALID_SCHEDULE_WINDOW');
    expect(await countRows()).toBe(rowsBefore); // the rejected request did not wipe or change anything
  });

  test('ADMIN checks and updates the clinic settings (Asia/Bangkok) and they persist', async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto('/admin/settings');

    await expect(page.getByRole('heading', { level: 1, name: 'Clinic Settings' })).toBeVisible();
    const original = await getJson(page, '/api/v1/settings/public');
    // the form shows what the server holds, in the clinic timezone
    await expect(page.getByLabel('Clinic name')).toHaveValue(original.clinicName);
    await expect(page.getByLabel('Timezone')).toHaveValue('Asia/Bangkok');
    await expect(page.getByLabel('Fixed start interval')).toHaveValue(String(original.fixedStartIntervalMinutes));
    await expect(page.getByLabel('Cancellation cutoff (hours)')).toHaveValue(String(original.cancellationCutoffHours));

    const updated = {
      clinicName: `E2E Clinic ${stamp()}`,
      fixedStartIntervalMinutes: original.fixedStartIntervalMinutes === 30 ? 20 : 30,
      cancellationCutoffHours: original.cancellationCutoffHours === 12 ? 36 : 12,
    };

    await page.getByLabel('Clinic name').fill(updated.clinicName);
    await page.getByLabel('Fixed start interval').selectOption(String(updated.fixedStartIntervalMinutes));
    await page.getByLabel('Cancellation cutoff (hours)').fill(String(updated.cancellationCutoffHours));
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(page.getByRole('status')).toContainText('saved successfully');

    await page.reload();
    await expect(page.getByLabel('Clinic name')).toHaveValue(updated.clinicName);
    await expect(page.getByLabel('Timezone')).toHaveValue('Asia/Bangkok');
    await expect(page.getByLabel('Fixed start interval')).toHaveValue(String(updated.fixedStartIntervalMinutes));
    await expect(page.getByLabel('Cancellation cutoff (hours)')).toHaveValue(String(updated.cancellationCutoffHours));

    // the public endpoint (used by every other screen) and PostgreSQL both reflect it
    expect(await getJson(page, '/api/v1/settings/public')).toMatchObject({ ...updated, timezone: 'Asia/Bangkok' });
    const row = await db.clinicSetting.findFirst();
    expect(row).toMatchObject({ ...updated, timezone: 'Asia/Bangkok' });

    // and the change was audited (AC-F007-01)
    const audit = await db.auditLog.findFirst({
      where: { actionType: 'CLINIC_SETTINGS_UPDATED', entityId: row.settingId, createdAt: { gte: startedAt } },
    });
    expect(audit).not.toBeNull();
  });
});
