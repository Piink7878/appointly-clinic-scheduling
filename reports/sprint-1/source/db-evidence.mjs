// ==============================================================================
// Appointly - Deliverable 1 database evidence
// ==============================================================================
// Runs read-only SQL against the PostgreSQL 16 database behind the running API and prints
// the result sets in psql style. Password hashes are truncated (algorithm and parameters only).
//
//   DATABASE_URL=postgresql://.../appointly_test node db-evidence.mjs > ../figures/logs/12-db-evidence.log
// ==============================================================================

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DB_USER = decodeURIComponent(new URL(process.env.DATABASE_URL).username);
const CONTAINER = process.env.PG_CONTAINER || 'appointly-pg16-evidence';
const psql = (args) => execFileSync('docker', ['exec', CONTAINER, 'psql', '-U', DB_USER, '-d', 'appointly_test', ...args], { encoding: 'utf8' });

async function q(title, sql) {
  const one = sql.replace(/\s+/g, ' ').trim();
  console.log(`
-- ${title}`);
  console.log(`appointly_test=> ${one};`);
  console.log(psql(['-P', 'pager=off', '-c', one]).trimEnd());
}

try {
  console.log(`-- Appointly Sprint 1 - database evidence (${new Date().toISOString()})`);
  console.log(`-- ${psql(['-tAc', 'select version()']).trim().split(' on ')[0]}`);

  await q('Versioned Prisma migrations (Definition of Done 3)', 'select migration_name, finished_at from _prisma_migrations order by started_at');
  await q(
    'F-001: seeded accounts; passwords stored as Argon2id hashes (value truncated)',
    `select email, role, account_status, left(password_hash, 31) || '...' as password_hash from users order by role, email`
  );
  await q(
    'F-002: the patient profile edited through the UI is stored in PostgreSQL',
    `select p.full_name, p.phone_number, p.date_of_birth, u.email from patients p join users u on u.user_id = p.user_id where u.email = 'patient.arisa@appointly.local'`
  );
  await q(
    'F-004 / F-005: the service created in the UI and its doctor assignments',
    `select s.service_name, s.duration_minutes, s.service_status, d.full_name as assigned_doctor, u.email
       from medical_services s join doctor_services ds on ds.service_id = s.service_id
       join doctors d on d.doctor_id = ds.doctor_id join users u on u.user_id = d.user_id
      where s.service_name = 'Dental Cleaning' order by d.full_name`
  );
  await q(
    'F-006: split shifts saved on Saturday (day_of_week = 6) by the doctor',
    `select u.email, ds.day_of_week, ds.start_time, ds.end_time, ds.is_active
       from doctor_schedules ds join doctors d on d.doctor_id = ds.doctor_id join users u on u.user_id = d.user_id
      where u.email = 'doctor@appointly.local' and ds.day_of_week = 6 order by ds.start_time`
  );
  await q(
    'F-006: the full-day HOLIDAY exception (start_time and end_time are NULL)',
    `select u.email, e.exception_date, e.exception_type, e.start_time, e.end_time, e.reason
       from schedule_exceptions e join doctors d on d.doctor_id = e.doctor_id join users u on u.user_id = d.user_id`
  );
  await q('F-006: database CHECK constraints guarding schedule windows', `select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid = 'doctor_schedules'::regclass and contype = 'c' order by conname`);
  await q(
    'F-007: clinic settings after the administrator update',
    `select clinic_name, timezone, fixed_start_interval_minutes, cancellation_cutoff_hours, reminder_lead_hours from clinic_settings`
  );
  await q(
    'F-007: the settings change was audited with the administrator user and a UTC timestamp (AC-F007-01)',
    `select a.action_type, a.entity_type, u.email as performed_by, a.created_at
       from audit_logs a join users u on u.user_id = a.user_id
      where a.action_type = 'CLINIC_SETTINGS_UPDATED' order by a.created_at desc limit 3`
  );
  await q(
    'Audit trail of the UI journeys (most recent 10 entries)',
    `select a.action_type, a.entity_type, u.email as performed_by, a.created_at from audit_logs a join users u on u.user_id = a.user_id order by a.created_at desc limit 10`
  );
} finally {
  // nothing to close: every query is a separate psql call
}
