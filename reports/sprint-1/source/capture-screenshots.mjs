// ==============================================================================
// Appointly - Deliverable 1 UI evidence capture
// ==============================================================================
// Drives the REAL running stack (React production bundle served by the Express API, PostgreSQL 16)
// through the Sprint 1 journeys as the seeded users and saves a screenshot at each key step.
// Nothing is mocked: no route interception, no stubbed responses.
//
//   BASE_URL=http://localhost:4100 node capture-screenshots.mjs
//
// Prerequisite: API running against a freshly migrated + seeded database (see README).
// Output: ../figures/ui/*.png and ../figures/ui/manifest.json
// ==============================================================================

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const { chromium } = createRequire(join(repo, 'package.json'))('playwright-core');

const BASE = process.env.BASE_URL || 'http://localhost:4100';
const OUT = resolve(here, '../figures/ui');
mkdirSync(OUT, { recursive: true });

const PASSWORD = 'ChangeMe123!';
const ACCOUNTS = { admin: 'admin@appointly.local', doctor: 'doctor@appointly.local', patient: 'patient.arisa@appointly.local' };
const manifest = [];

const expectVisible = async (locator, what) => {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    throw new Error(`expected to see: ${what}`);
  }
};

async function shot(page, file, caption, { full = true } = {}) {
  await page.waitForLoadState('networkidle');
  // a full-page capture of a scrolled page would draw the sticky header in the middle of the image
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, file), fullPage: full });
  manifest.push({ file, url: new URL(page.url()).pathname + new URL(page.url()).search, caption });
  console.log('  saved', file);
}

/**
 * A contiguous horizontal band of the full page (document coordinates, CSS px). Used for very tall pages (seven day
 * cards) so the printed figure stays legible; the band is a plain crop of the real page, nothing is hidden or edited.
 */
async function region(page, file, caption, y0, y1) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const top = Math.max(0, Math.round(y0));
  const bottom = Math.min(height, Math.round(y1));
  await page.screenshot({ path: join(OUT, file), fullPage: true, clip: { x: 0, y: top, width: 1280, height: bottom - top } });
  manifest.push({ file, url: new URL(page.url()).pathname, caption, crop: `page y ${top}–${bottom} of ${height} px` });
  console.log('  saved', file);
}

/** Document Y (CSS px) of an element, and of the end of the page. */
const yOf = async (page, locator) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  return (await locator.first().boundingBox()).y;
};
const docHeight = (page) => page.evaluate(() => document.documentElement.scrollHeight);

async function signIn(page, email, password = PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function main() {
  const browser = await chromium.launch();
  const ctx = (role) => browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 }).then(async (c) => ({ c, page: await c.newPage(), role }));

  try {
    // ---------------------------------------------------------------- F-001 authentication & RBAC
    console.log('F-001 authentication and RBAC');
    {
      const { c, page } = await ctx('anon');
      await page.goto(`${BASE}/login`);
      await expectVisible(page.getByRole('button', { name: 'Sign In' }), 'login form');
      await shot(page, 'ui-01-login.png', 'Sign-in page (F-001)', { full: false });

      await page.getByLabel('Email Address').fill(ACCOUNTS.patient);
      await page.getByLabel('Password', { exact: true }).fill('wrong-password-123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expectVisible(page.getByRole('alert'), 'login error message');
      await shot(page, 'ui-02-login-wrong-password.png', 'Wrong password rejected with a clear message and no session (AC-F001-02)', { full: false });
      await c.close();
    }
    {
      const { c, page } = await ctx('patient');
      await signIn(page, ACCOUNTS.patient);
      await page.goto(`${BASE}/patient/services`);
      await expectVisible(page.getByRole('heading', { level: 1 }), 'patient service catalogue heading');
      await shot(page, 'ui-03-patient-service-catalogue.png', 'Patient service catalogue (F-004): only active services are listed');

      await page.goto(`${BASE}/admin/doctors`);
      await expectVisible(page.getByText('403 — Access Denied'), '403 page');
      await shot(page, 'ui-04-rbac-patient-blocked-admin.png', 'A PATIENT opening /admin/doctors is redirected to the 403 page (AC-F001-03)', { full: false });
      await c.close();
    }

    // ---------------------------------------------------------------- F-002 patient profile
    console.log('F-002 patient profile');
    {
      const { c, page } = await ctx('patient');
      await signIn(page, ACCOUNTS.patient);
      await page.goto(`${BASE}/patient/profile`);
      await expectVisible(page.locator('#profile-fullName'), 'profile form');
      await page.waitForFunction(() => document.querySelector('#profile-fullName')?.value);
      await page.locator('#profile-phoneNumber').fill('0898765432');
      await page.locator('#profile-dateOfBirth').fill('1991-02-03');
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expectVisible(page.getByRole('status'), 'profile saved message');
      await shot(page, 'ui-05-patient-profile-saved.png', 'Patient edits their own profile and it is saved (AC-F002-01)');
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#profile-phoneNumber')?.value === '0898765432');
      await shot(page, 'ui-06-patient-profile-after-reload.png', 'After a page reload the profile is loaded again from PostgreSQL (AC-F002-01)');
      await c.close();
    }

    // ---------------------------------------------------------------- F-003 / F-004 / F-005 admin catalogue
    console.log('F-003, F-004, F-005 admin catalogue');
    const serviceName = 'Dental Cleaning';
    {
      const { c, page } = await ctx('admin');
      await signIn(page, ACCOUNTS.admin);

      await page.goto(`${BASE}/admin/patients`);
      await expectVisible(page.getByRole('heading', { level: 1 }), 'patient directory');
      await shot(page, 'ui-07-admin-patients.png', 'Administrator patient directory (F-002, administrator access only)');

      await page.goto(`${BASE}/admin/doctors`);
      await expectVisible(page.getByRole('row').filter({ hasText: ACCOUNTS.doctor }), 'doctor row');
      await shot(page, 'ui-08-admin-doctors.png', 'Administrator doctor management list with account status (F-003)');

      await page.goto(`${BASE}/admin/services`);
      await page.getByRole('button', { name: /Add New Service/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Add New Service' });
      await dialog.getByLabel('Service name').fill(serviceName);
      await dialog.getByLabel('Description').fill('Routine scaling and polishing.');
      await dialog.getByLabel('Duration (minutes)').fill('30');
      await shot(page, 'ui-09-admin-service-create-form.png', 'Administrator creates a medical service with a 30-minute duration (AC-F004-01)', { full: false });
      await dialog.getByRole('button', { name: 'Create Service' }).click();
      await expectVisible(page.getByRole('row').filter({ hasText: serviceName }), 'created service row');
      await shot(page, 'ui-10-admin-service-created.png', 'The new service appears in the catalogue as Active (AC-F004-01)');

      await page.goto(`${BASE}/admin/doctors`);
      const row = page.getByRole('row').filter({ hasText: ACCOUNTS.doctor });
      await row.getByRole('button', { name: /Manage services for/ }).click();
      const manage = page.getByRole('dialog', { name: 'Manage Services' });
      await manage.getByRole('button', { name: `Assign ${serviceName}` }).click();
      await expectVisible(manage.getByRole('button', { name: `Unassign ${serviceName}` }), 'assignment applied');
      await shot(page, 'ui-11-admin-assign-service-to-doctor.png', 'Administrator assigns the service to an active doctor (AC-F005-01)', { full: false });
      await manage.getByRole('button', { name: 'Done' }).click();
      await c.close();
    }
    {
      const { c, page } = await ctx('patient');
      await signIn(page, ACCOUNTS.patient);
      await page.goto(`${BASE}/patient/services`);
      await page.getByRole('link', { name: `View available doctors for ${serviceName}` }).click();
      await page.waitForURL(/\/patient\/doctors\?serviceId=/);
      await expectVisible(page.getByRole('list', { name: 'Doctor list' }).getByRole('heading', { level: 2 }), 'doctor card');
      await shot(page, 'ui-12-patient-doctors-filtered-by-service.png', 'A patient filtering by the new service sees only the doctor assigned to it (AC-F005-03)');
      await c.close();
    }

    // ---------------------------------------------------------------- F-006 doctor self-schedule
    console.log('F-006 doctor self-schedule');
    {
      const { c, page } = await ctx('doctor');
      await signIn(page, ACCOUNTS.doctor);
      await page.goto(`${BASE}/doctor/schedule`);
      await expectVisible(page.getByRole('heading', { level: 3, name: 'Saturday' }), 'Saturday section');
      const add = () => page.getByRole('button', { name: 'Add time slot for Saturday' }).click();

      // negative case first (nothing is saved), then the positive case
      await add();
      await add();
      await page.getByLabel('Saturday slot 1 start time').fill('09:00');
      await page.getByLabel('Saturday slot 1 end time').fill('13:00');
      await page.getByLabel('Saturday slot 2 start time').fill('12:00');
      await page.getByLabel('Saturday slot 2 end time').fill('16:00');
      await page.getByRole('button', { name: 'Save Schedule' }).click();
      await expectVisible(page.getByText('Overlaps with 09:00–13:00'), 'overlap message');
      const sat = () => yOf(page, page.getByRole('heading', { level: 3, name: 'Saturday' }));
      const sun = () => yOf(page, page.getByRole('heading', { level: 3, name: 'Sunday' }));
      const hol = () => yOf(page, page.getByRole('heading', { name: /Holidays & Time Off/ }));
      await region(page, 'ui-13a-doctor-schedule-overlap-top.png', 'Top of the page: the error banner after pressing Save (AC-F006-02)', 0, (await sun()) - 30);
      await region(page, 'ui-13b-doctor-schedule-overlap-saturday.png', 'Saturday: windows 09:00–13:00 and 12:00–16:00 are refused, the second window is marked, and nothing is saved (AC-F006-02)', (await sat()) - 30, (await hol()) - 30);

      await page.reload();
      await expectVisible(page.getByRole('heading', { level: 3, name: 'Saturday' }), 'Saturday section after reload');
      await add();
      await add();
      await page.getByLabel('Saturday slot 1 start time').fill('09:00');
      await page.getByLabel('Saturday slot 1 end time').fill('12:00');
      await page.getByLabel('Saturday slot 2 start time').fill('13:00');
      await page.getByLabel('Saturday slot 2 end time').fill('17:00');
      await page.getByRole('button', { name: 'Save Schedule' }).click();
      await expectVisible(page.getByRole('status'), 'schedule saved message');
      await region(page, 'ui-14a-doctor-schedule-saved-top.png', 'Top of the page: confirmation after pressing Save (AC-F006-01)', 0, (await sun()) - 30);
      await region(page, 'ui-14b-doctor-schedule-saved-saturday.png', 'Saturday: split shifts 09:00–12:00 and 13:00–17:00 are saved (AC-F006-01)', (await sat()) - 30, (await hol()) - 30);

      await page.reload();
      await page.waitForFunction(() => document.querySelector('input[aria-label="Saturday slot 2 end time"]')?.value === '17:00');
      await region(page, 'ui-15-doctor-schedule-after-reload-saturday.png', 'After a page reload the Saturday shifts are loaded again from PostgreSQL (AC-F006-01)', (await sat()) - 30, (await hol()) - 30);

      // full-day holiday exception (AC-F006-03)
      await page.getByLabel('Date').fill('2026-12-31');
      await page.getByLabel('Reason').fill('New Year holiday');
      await page.getByRole('button', { name: 'Add Exception' }).click();
      await expectVisible(page.getByRole('list', { name: 'Schedule exceptions' }), 'exception list');
      const holTop = await hol();
      await region(page, 'ui-16-doctor-holiday-exception.png', 'A full-day HOLIDAY exception (31 Dec 2026) is added to the doctor’s schedule (AC-F006-03)', holTop - 12, (await docHeight(page)) - 60);
      await c.close();
    }

    // ---------------------------------------------------------------- F-007 admin schedules & settings
    console.log('F-007 administrator schedules and clinic settings');
    {
      const { c, page } = await ctx('admin');
      await signIn(page, ACCOUNTS.admin);
      await page.goto(`${BASE}/admin/schedules`);
      await expectVisible(page.getByRole('heading', { level: 1, name: 'Doctor Schedules' }), 'schedules heading');
      const select = page.locator('select').first();
      const options = await select.locator('option').all();
      for (const o of options) {
        const text = (await o.textContent()) || '';
        // the seeded doctor account (doctor@appointly.local) is the non-"Lead" Dr. Somchai Prasert and has the baseline shifts
        if (text.includes('Prasert') && !text.includes('Lead')) {
          await select.selectOption({ index: options.indexOf(o) });
          break;
        }
      }
      await expectVisible(page.getByRole('heading', { level: 2, name: /Schedule for/ }), 'selected doctor schedule');
      const adminSat = await yOf(page, page.getByRole('heading', { level: 3, name: 'Saturday' }));
      await region(page, 'ui-17a-admin-doctor-schedules-top.png', 'Administrator selects a doctor to view and override the schedule (AC-F007-03)', 0, (await yOf(page, page.getByRole('heading', { level: 3, name: 'Sunday' }))) - 30);
      const adminHol = await yOf(page, page.getByRole('heading', { name: /Holidays & Time Off/ }));
      await region(page, 'ui-17b-admin-doctor-schedules-saturday.png', 'The doctor’s Saturday shifts, saved earlier by the doctor, as the administrator sees them (AC-F007-03)', adminSat - 30, adminHol - 30);
      const exList = page.getByRole('list', { name: 'Schedule exceptions' });
      const exTop = await yOf(page, exList);
      const exHeight = (await exList.boundingBox()).height;
      await region(page, 'ui-17c-admin-doctor-schedules-holiday.png', 'The doctor’s holiday exception, also saved earlier by the doctor (AC-F007-03)', exTop - 16, exTop + exHeight + 16);

      await page.goto(`${BASE}/admin/settings`);
      await expectVisible(page.getByRole('heading', { level: 1, name: 'Clinic Settings' }), 'settings heading');
      await page.waitForFunction(() => document.querySelector('input[id*="clinic" i], input[name*="clinic" i]')?.value);
      await page.getByLabel('Fixed start interval').selectOption('30');
      await page.getByLabel('Cancellation cutoff (hours)').fill('12');
      await page.getByRole('button', { name: 'Save Settings' }).click();
      await expectVisible(page.getByRole('status'), 'settings saved message');
      await shot(page, 'ui-18-admin-settings-saved.png', 'Administrator updates the clinic settings (start interval 30 min, cancellation cutoff 12 h) (AC-F007-01)');
      await c.close();
    }
  } finally {
    await browser.close();
    writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
  console.log(`done: ${manifest.length} screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error('CAPTURE FAILED:', e.message);
  process.exit(1);
});
