# Sprint 1 end-to-end tests (Playwright)

`sprint-1.spec.ts` drives a real Chromium browser through the three Sprint 1 journeys
(STS-S1-001 … 009). Nothing is mocked: the Express API runs against a real, seeded
PostgreSQL database and serves the production build of the React client.

| Journey | Covers |
| --- | --- |
| 1 — Auth, RBAC & Patient Profile | F-001, F-002: seeded logins land in the right portal, a PATIENT is blocked from `/admin/doctors`, profile edits survive a reload |
| 2 — Admin Catalog & Doctor-Service Assignment | F-003, F-004, F-005: admin creates a service and assigns it; a patient sees only that doctor |
| 3 — Doctor Schedule, Overlap Rejection & Settings | F-006, F-007: shifts persist, overlaps are refused (UI + API 422), clinic settings update |

## Run

1. Use a **disposable** database that has the migrations and seed applied
   (`server/`: `npx prisma migrate deploy && npm run prisma:seed`).
   The run is **refused** unless the database name ends in `_test` (override: `E2E_ALLOW_ANY_DB=1`).
2. First time only: `npx playwright install chromium`.
3. From `client/`:

   ```powershell
   $env:DATABASE_URL = "postgresql://USER:PASSWORD@localhost:5432/appointly_test?schema=public"
   npm run test:e2e        # builds the client, starts the API on :4100, runs the journeys
   npm run test:e2e:only   # same, without rebuilding the client
   npm run test:e2e:report # open the HTML report of the last run
   ```

The journeys change real rows (service, profile, shifts, settings) and restore them in
`afterEach` / `afterAll` hooks, so the suite can be re-run on the same database.

Not part of `npm test` (Vitest) or the CI workflow, which has no browsers installed.
