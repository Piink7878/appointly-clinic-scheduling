# Lab 06 Part D — Execution Plan
## Appointly: Schedule Exception Validation Defects (DEF-AP-02 & DEF-AP-03)

> **Status:** 🔵 IN PROGRESS (Approved)
> **Prepared:** 2026-11-26 | **Timezone:** Asia/Bangkok (UTC+7)
> **Repo:** `Piink7878/appointly-clinic-scheduling`

---

## 1. Summary & Scope

### Defects Being Fixed

#### DEF-AP-02 — Duplicate / Overlapping Schedule Exceptions (Major — Release-blocking)

| Field | Detail |
|-------|--------|
| **Endpoint** | `POST /api/v1/doctors/me/exceptions` (and mirrored `POST /api/v1/admin/doctors/:doctorId/exceptions`) |
| **Root Cause** | `scheduleService.createException()` in `service.ts` calls `scheduleValidator.validateException()`, which validates the *shape* of one exception but performs **no DB-level duplicate/overlap check**. The `prisma.$transaction` then inserts unconditionally. |
| **Path A** | Posting a second full-day `HOLIDAY` for the same date (e.g. `2026-12-31`) → `201 Created` ❌ (should be `409 CONFLICT`) |
| **Path B** | Posting a partial-day exception (e.g. `13:00–17:00`) on a date already carrying a full-day `HOLIDAY` → `201 Created` ❌ (should be `409 CONFLICT`) |
| **Fix location** | `service.ts` → `createException()`: add pre-insert DB query + overlap logic before `prisma.$transaction` |

#### DEF-AP-03 — Past-Date Exceptions Accepted (Major — Release-blocking)

| Field | Detail |
|-------|--------|
| **Endpoint** | `POST /api/v1/doctors/me/exceptions` (and mirrored admin endpoint) |
| **Root Cause** | `scheduleValidator.validateException()` validates that the date is a *real* calendar date but does **not** compare it against today in `Asia/Bangkok` timezone. `exceptionDate: '2020-01-01'` → `201 Created` ❌ (should be `400 VALIDATION_ERROR`) |
| **Fix location** | `scheduleValidator.ts` → `validateException()`: add today-comparison using `toBangkokDateString(new Date())` from `timezone.ts` |

#### DEF-AP-01 — Idle Access Token 401 (Minor)

**Decision:** Recorded as a **Known Minor Limitation** — will NOT be fixed in this pass.

---

### Files to Be Modified

| File | Type | Change Summary |
|------|------|----------------|
| `server/src/modules/schedules/scheduleValidator.ts` | Existing | Add `toBangkokDateString` import; insert past-date guard in `validateException()` |
| `server/src/modules/schedules/service.ts` | Existing | Add `parseTimeToSeconds` import; insert DB overlap check in `createException()` inside `prisma.$transaction` |
| `server/tests/sprint-1/integration/schedule-exception-defects.test.ts` | **New** | RED/GREEN integration tests for DEF-AP-02 (Path A, Path B) and DEF-AP-03 with `beforeAll`/`afterAll` test-date cleanup |
| `server/tests/sprint-1/integration/timezone-handling.test.ts` | Existing | Delete each created `2099-12-25` test exception between `it.each` iterations so consecutive cases don't collide with DEF-AP-02 |

> [!NOTE]
> The admin endpoint (`POST /api/v1/admin/doctors/:doctorId/exceptions`) is handled by `ScheduleController.createDoctorExceptionAdmin()`, which calls the **same** `scheduleService.createException()`. Fixing the shared service layer automatically protects both endpoints — no separate controller changes needed.

---

## 2. Detailed Code-Change Design

### Fix A — Past-Date Guard (`scheduleValidator.ts`)

Add `toBangkokDateString` to the existing import at the top of the file:

```ts
import { parseClinicCalendarDate, toBangkokDateString } from '../../shared/utils/timezone';
```

Inside `validateException()`, reuse the already-computed `dateStr` from the existing `parseClinicCalendarDate` call and append immediately after:

```ts
// DEF-AP-03: Reject past dates (compare against today in Asia/Bangkok)
const todayStr = toBangkokDateString(new Date()); // e.g. "2026-11-26"
if (dateStr < todayStr) {
  throw AppError.badRequest(
    `exceptionDate "${dateStr}" is in the past. Only today or future dates are allowed.`,
    'VALIDATION_ERROR'
  );
}
```

> [!IMPORTANT]
> `parseClinicCalendarDate` is already called once earlier in `validateException()` to validate the date format; capture its return value into `dateStr` and reuse it for this comparison — do not call it twice.

### Fix B — Overlap/Duplicate Guard (`service.ts`)

Add `parseTimeToSeconds` to the existing import from `scheduleValidator`:

```ts
import { scheduleValidator, type ShiftInput, type ExceptionInput, parseTimeToSeconds } from './scheduleValidator';
```

Insert the following block in `createException()`, after Step 2 (`scheduleValidator.validateException`) and before Step 3 (the `prisma.$transaction` block). Note: `dateStr` and `parsedDate` are already in scope from Step 3 of the existing code (move `parsedDate` computation before this block):

```ts
// DEF-AP-02: Reject duplicate / overlapping exceptions on the same date
const existingOnDate = await prisma.scheduleException.findMany({
  where: { doctorId, exceptionDate: parsedDate },
});

if (existingOnDate.length > 0) {
  const incomingIsFullDay = !input.startTime && !input.endTime;
  const hasFullDayConflict = existingOnDate.some(
    (e) => e.startTime === null && e.endTime === null
  );

  if (incomingIsFullDay || hasFullDayConflict) {
    // Full-day exception always conflicts with any existing exception on the same date
    throw AppError.conflict(
      `A schedule exception already exists for ${dateStr}. Remove the existing exception before adding a new one.`,
      'SCHEDULE_EXCEPTION_CONFLICT'
    );
  }

  // Both are partial-day — check strict time overlap
  const inStart = input.startTime ? parseTimeToSeconds(input.startTime) : 0;
  const inEnd   = input.endTime   ? parseTimeToSeconds(input.endTime)   : 86400;

  const hasTimeOverlap = existingOnDate.some((e) => {
    if (e.startTime === null || e.endTime === null) return true; // full-day beats partial
    const eStart = parseTimeToSeconds(e.startTime);
    const eEnd   = parseTimeToSeconds(e.endTime);
    return inStart < eEnd && eStart < inEnd; // strict overlap (back-to-back OK)
  });

  if (hasTimeOverlap) {
    throw AppError.conflict(
      `The exception window ${input.startTime}–${input.endTime} on ${dateStr} overlaps an existing exception.`,
      'SCHEDULE_EXCEPTION_CONFLICT'
    );
  }
}
```

---

## 3. Step-by-Step Execution Checklist

### Step 1 — Issue & Branch

- [x] Create a GitHub Issue on `Piink7878/appointly-clinic-scheduling`:
  - **Title:** `fix: reject duplicate/overlapping and past-date schedule exceptions (DEF-AP-02, DEF-AP-03)`
  - **Labels:** `lab6`, `bug`
  - **Body:** Reference both defects (DEF-AP-02 Path A, Path B; DEF-AP-03), affected endpoints, expected HTTP codes, and link to this plan.
- [x] Locally: `git checkout staging && git pull origin staging`
- [x] Create branch: `git checkout -b fix/<issue#>-schedule-exception-validation`
- [x] Record Issue # in Evidence table below.

### Step 2 — RED Phase (Test-First)

- [x] Write new Vitest integration test file `server/tests/sprint-1/integration/schedule-exception-defects.test.ts` covering:
  - **DEF-AP-02 Path A:** POST a full-day `HOLIDAY` on `2026-12-31`, then POST a second full-day `HOLIDAY` on `2026-12-31` → expect `409` with `body.error.code === 'SCHEDULE_EXCEPTION_CONFLICT'`
  - **DEF-AP-02 Path B:** POST a full-day `HOLIDAY` on `2026-12-30`, then POST a partial-day `HOLIDAY` `13:00–17:00` on `2026-12-30` → expect `409` with `body.error.code === 'SCHEDULE_EXCEPTION_CONFLICT'`
  - **DEF-AP-03:** POST with `exceptionDate: '2020-01-01'` → expect `400` with `body.error.code === 'VALIDATION_ERROR'`
  - **Happy-path guard:** Two non-overlapping partials on `2027-01-15` (`09:00–12:00` then `13:00–17:00`) both succeed `201` _(prevents over-blocking regression)_
- [x] Run: `cd server && npx vitest run --reporter=verbose schedule-exception-defects` and confirm:
  - DEF-AP-02 Path A test **fails** (received `201`, expected `409`)
  - DEF-AP-02 Path B test **fails** (received `201`, expected `409`)
  - DEF-AP-03 test **fails** (received `201`, expected `400`)
  - Happy-path test **passes**
  - No syntax errors or DB connection errors
- [x] Save full terminal output + exact command + current commit SHA to `docs/labs/lab-06/red-test.log`
- [x] `git add server/tests/sprint-1/integration/schedule-exception-defects.test.ts docs/labs/lab-06/red-test.log`
- [x] `git commit -m "test(DEF-AP-02, DEF-AP-03): add RED integration tests for schedule exception validation"`
- [x] Record RED Commit SHA in Evidence table.

### Step 3 — GREEN Phase & Regression

- [x] **Fix `scheduleValidator.ts`:** Add `toBangkokDateString` import; insert past-date guard in `validateException()` per design in §2 Fix A.
- [x] **Fix `service.ts`:** Add `parseTimeToSeconds` to import; insert overlap/duplicate check in `createException()` per design in §2 Fix B.
- [x] Run new test file: `cd server && npx vitest run --reporter=verbose schedule-exception-defects` → all 4 tests must **pass**.
- [x] Save passing output to `docs/labs/lab-06/green-test.log`.
- [x] Run full server regression: `cd server && npm test` → all previously passing tests must remain green (updated `timezone-handling.test.ts` to clean up between `it.each` iterations on `2099-12-25`).
- [x] Run client regression: `cd client && npm test` → confirm no regressions.
- [x] Save combined regression summary (server pass/fail/skip counts + client pass/fail/skip counts) to `docs/labs/lab-06/regression-summary.log`.
- [x] `git add server/src/modules/schedules/scheduleValidator.ts server/src/modules/schedules/service.ts docs/labs/lab-06/green-test.log docs/labs/lab-06/regression-summary.log`
- [x] `git commit -m "fix(DEF-AP-02, DEF-AP-03): reject duplicate/overlapping and past-date schedule exceptions"`
- [x] Record GREEN Commit SHA in Evidence table.
- [x] Update `docs/labs/lab-06/part-d-plan.md`: mark Steps 1–3 items `[x]`, fill in SHAs and test counts in Evidence table, and commit the updated plan.

### Step 4 — PR to `staging` ⛔ HUMAN GATE — STOP & WAIT

- [x] `git push origin fix/37-schedule-exception-validation`
- [x] Open PR on GitHub:
  - **Base:** `staging`
  - **Title:** `fix: reject duplicate/overlapping and past-date schedule exceptions (DEF-AP-02, DEF-AP-03)`
  - **Body:** `Part of #37` — include one-paragraph summary of both fixes and links to `red-test.log`, `green-test.log`, `regression-summary.log`.
  - Request teammate review/approval.
- [x] Record Staging PR # in Evidence table (`#38`).
- [ ] **⛔ STOP — wait for teammate review/approval and merge into `staging` before proceeding to Step 5.**

### Step 5 — Release PR to `main` & Redeploy ⛔ HUMAN GATE — STOP & WAIT

- [ ] After `staging` merge and CI green, open **release PR** `staging → main`:
  - **Title:** `release: schedule exception validation fixes (DEF-AP-02, DEF-AP-03)`
  - **Body:** `Closes #<issue#>` — link test logs and regression summary.
- [ ] Record Release PR # in Evidence table.
- [ ] **⛔ STOP — wait for approval, merge, and `Deploy demo` CI workflow to push to Cloud Run.**
- [ ] After deploy completes, record new Main Commit SHA and Cloud Run Revision in Evidence table.

### Step 6 — Post-Deploy Cleanup & Partner Retest

- [ ] **Clean up production test data** created before the fix was deployed:
  - Remove any `ScheduleException` records with `exceptionDate = '2020-01-01'` (invalid past-date records) from the production DB.
  - Remove any duplicate `ScheduleException` records with `exceptionDate = '2026-12-31'` (keep at most one valid record per doctor; delete the extras created during UAT).
  - Verify doctor `isActive` status is correct (not affected by this fix, but confirm no collateral damage from testing).
- [ ] **Notify the EquipFlow partner team:**
  - Share production Cloud Run URL and new revision ID.
  - Confirm **DEF-AP-02 closed**: `POST .../exceptions` now returns `409 SCHEDULE_EXCEPTION_CONFLICT` for duplicate/overlapping exceptions.
  - Confirm **DEF-AP-03 closed**: `POST .../exceptions` now returns `400 VALIDATION_ERROR` for past `exceptionDate`.
  - Note **DEF-AP-01** (Idle 401) as a Known Minor Limitation — not fixed in this pass, frontend should handle token refresh.
- [ ] Update `docs/labs/lab-06/part-d-plan.md`: mark all Step 6 items `[x]`.

---

## 4. Evidence & Version Tracking Table

| Artifact | Value |
|----------|-------|
| GitHub Issue # | `#37` |
| Branch Name | `fix/37-schedule-exception-validation` |
| RED Commit SHA | `2d0dfab7a291f075d66c30a76c02a637aa48db3e` |
| RED Test Log | `docs/labs/lab-06/red-test.log` |
| RED Test Counts (pass / fail / skip) | `1 passed / 3 failed / 0 skipped (4 total)` |
| GREEN Commit SHA | `237593115deca5c207184932f5f2ea529bf0d4da` |
| GREEN Test Log | `docs/labs/lab-06/green-test.log` |
| GREEN Test Counts (pass / fail / skip) | `4 passed / 0 failed / 0 skipped (4 total)` |
| Regression Log | `docs/labs/lab-06/regression-summary.log` |
| Server Regression Counts | `25 files, 545 passed / 0 failed / 0 skipped (545 total)` |
| Client Regression Counts | `10 files, 320 passed / 0 failed / 0 skipped (320 total)` |
| Staging PR # | `#38` (https://github.com/Piink7878/appointly-clinic-scheduling/pull/38) |
| Release PR # | _(fill after Step 5)_ |
| New Main Commit SHA | _(fill after Step 5 merge)_ |
| Cloud Run Revision | _(fill after Step 5 deploy)_ |

---

## 5. Known Minor Limitation (Not Fixed in This Pass)

| ID | Severity | Description | Decision |
|----|----------|-------------|----------|
| DEF-AP-01 | Minor | Idle access token causes `401 Unauthorized` on the next API call when the access token expires mid-session | Recorded as a Known Minor Limitation. The frontend should handle token refresh; not release-blocking. No fix applied. |

---

## 6. Test File Outline — `schedule-exception-defects.test.ts`

```
// server/tests/sprint-1/integration/schedule-exception-defects.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { prisma } from '../../../src/shared/database';
import { cookiesOf } from '../../helpers';

describe('Schedule Exception Validation Defects (DEF-AP-02, DEF-AP-03)', () => {
  let doctorCookies: string[];
  let primaryDoctorId: string;
  const createdExceptionIds: string[] = [];

  beforeAll(async () => {
    // Login as doctor@appointly.local (matches seeded test user)
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'doctor@appointly.local', password: 'ChangeMe123!' });
    expect(login.status).toBe(200);
    doctorCookies = cookiesOf(login);

    // Resolve doctorId
    const doc = await prisma.doctor.findUnique({ where: { userId: login.body.data.userId } });
    expect(doc).toBeDefined();
    primaryDoctorId = doc!.doctorId;
  });

  afterAll(async () => {
    if (createdExceptionIds.length > 0) {
      await prisma.scheduleException.deleteMany({
        where: { exceptionId: { in: createdExceptionIds } },
      });
    }
  });

  // ─── DEF-AP-02 Path A ─────────────────────────────────────────────────────
  describe('DEF-AP-02 Path A — Duplicate full-day HOLIDAY on the same date', () => {
    it('[RED→GREEN] second HOLIDAY on 2026-12-31 returns 409 SCHEDULE_EXCEPTION_CONFLICT', async () => {
      // First exception — must succeed
      const first = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({ exceptionDate: '2026-12-31', exceptionType: 'HOLIDAY', reason: 'Test Path A first' });
      expect(first.status).toBe(201);
      createdExceptionIds.push(first.body.data.exceptionId);

      // Second exception on same date — must be rejected
      const second = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({ exceptionDate: '2026-12-31', exceptionType: 'HOLIDAY', reason: 'Test Path A duplicate' });
      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
      expect(second.body.error.code).toBe('SCHEDULE_EXCEPTION_CONFLICT');
    });
  });

  // ─── DEF-AP-02 Path B ─────────────────────────────────────────────────────
  describe('DEF-AP-02 Path B — Partial-day overlaps existing full-day HOLIDAY', () => {
    it('[RED→GREEN] partial 13:00–17:00 on 2026-12-30 (already has full-day HOLIDAY) returns 409', async () => {
      // Full-day first
      const fullDay = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({ exceptionDate: '2026-12-30', exceptionType: 'HOLIDAY', reason: 'Full-day Path B' });
      expect(fullDay.status).toBe(201);
      createdExceptionIds.push(fullDay.body.data.exceptionId);

      // Partial-day on same date — must be rejected
      const partial = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({ exceptionDate: '2026-12-30', exceptionType: 'HOLIDAY', startTime: '13:00', endTime: '17:00' });
      expect(partial.status).toBe(409);
      expect(partial.body.success).toBe(false);
      expect(partial.body.error.code).toBe('SCHEDULE_EXCEPTION_CONFLICT');
    });
  });

  // ─── DEF-AP-03 ────────────────────────────────────────────────────────────
  describe('DEF-AP-03 — Past date rejected', () => {
    it('[RED→GREEN] POST exceptionDate 2020-01-01 returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({ exceptionDate: '2020-01-01', exceptionType: 'HOLIDAY', reason: 'Past date test' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/past/i);
    });
  });

  // ─── Happy-path guard ─────────────────────────────────────────────────────
  describe('Happy-path guard — Non-overlapping partial exceptions on same future date', () => {
    it('[passes from start] two non-overlapping partials on 2027-01-15 both succeed with 201', async () => {
      const first = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({ exceptionDate: '2027-01-15', exceptionType: 'BREAK', startTime: '09:00', endTime: '12:00' });
      expect(first.status).toBe(201);
      createdExceptionIds.push(first.body.data.exceptionId);

      const second = await request(app)
        .post('/api/v1/doctors/me/exceptions')
        .set('Cookie', doctorCookies)
        .send({ exceptionDate: '2027-01-15', exceptionType: 'BREAK', startTime: '13:00', endTime: '17:00' });
      expect(second.status).toBe(201);
      createdExceptionIds.push(second.body.data.exceptionId);
    });
  });
});
```

---

## 7. Shared Endpoint Scope Confirmation

```
POST /api/v1/doctors/me/exceptions
  → ScheduleController.createMyException()
      → createExceptionSchema.parse(req.body)        [validation.ts]
      → scheduleService.createException(..., false)   [service.ts]
          → scheduleValidator.validateException()     [scheduleValidator.ts ← Fix A]
          → DB overlap check                          [service.ts ← Fix B]
          → prisma.$transaction insert

POST /api/v1/admin/doctors/:doctorId/exceptions
  → ScheduleController.createDoctorExceptionAdmin()
      → createExceptionSchema.parse(req.body)        [same schema]
      → scheduleService.createException(..., true)   [same service method ← BOTH FIXES APPLY]
```

Both defect fixes are automatically inherited by the admin endpoint through the shared service layer. ✅
