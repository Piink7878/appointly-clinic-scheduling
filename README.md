# Appointly — Clinic Appointment & Scheduling Management System

Appointly is a three-tier responsive web application designed for single-clinic operations. It provides role-scoped portals for **Patients**, **Doctors**, and **Clinic Administrators**.

**Current state: Sprint 1 (release `v0.1.0-sprint1`).** Sprint 1 implements the foundation: authentication with role-based access control, patient profiles, doctor profiles, the medical service catalog, doctor–service assignment, doctor self-schedule management with overlap validation, and clinic settings. Appointment availability and booking (Sprint 2) and notifications and reports (Sprint 3) are planned, not yet built; the portals only show placeholder entries for them. See [`specs/04-three-sprint-plan.md`](specs/04-three-sprint-plan.md) for the roadmap.

---

## 1. Monorepo Architecture & Directory Structure

Appointly is structured as an npm workspaces monorepo:

```text
appointly-monorepo/
├── .env.example                         # Root template for monorepo & docker compose env vars
├── .gitignore                           # Git ignore rules protecting secrets (.env) & build artifacts
├── .dockerignore                        # Docker build ignore rules
├── Dockerfile                           # 3-stage unified production container (Cloud Run target)
├── docker-compose.yml                   # Local containerized orchestration (DB, migrate, server, client)
├── package.json                         # Root monorepo workspace configuration & runner scripts
├── eslint.config.mjs                    # Shared ESLint (flat config) for client and server
├── README.md                            # Primary project documentation & runbook
├── .github/
│   ├── dependabot.yml                   # Automated GitHub Actions dependency version updates
│   └── workflows/
│       ├── ci-docker.yml                # Automated CI pipeline (lint, tests, container build check)
│       └── deploy.yml                   # Automated GCP Cloud Run deployment via Workload Identity
├── client/                              # Presentation Layer (React 18 + TypeScript + Vite + Tailwind CSS)
│   ├── .env.example                     # Frontend runtime environment variables
│   ├── Dockerfile                       # Multi-stage Dockerfile for Nginx frontend serving
│   ├── nginx.conf                       # Production Nginx reverse proxy configuration
│   ├── package.json                     # Client dependencies & scripts
│   ├── tsconfig.json                    # Client TypeScript configuration
│   ├── vite.config.ts                   # Vite build and dev-server configuration (dev proxy to the API)
│   ├── playwright.config.ts             # Playwright end-to-end test configuration
│   ├── src/                             # Domain-partitioned frontend source tree
│   │   ├── shared/                      # Shared API client, UI components, context & utils
│   │   ├── modules/                     # S1–S3 domain modules (auth, patients, doctors, etc.)
│   │   └── router/                      # Role-protected route definitions
│   └── tests/                           # Sprint-partitioned tests: sprint-1 holds the component tests and e2e/ (Playwright); later sprints add their own folder
├── server/                              # Application Layer (Node.js + Express + TypeScript + Prisma)
│   ├── .env.example                     # Backend runtime environment variables
│   ├── Dockerfile                       # Backend container definition
│   ├── docker-entrypoint.sh             # Graceful SIGTERM container entrypoint
│   ├── package.json                     # Server dependencies & scripts
│   ├── tsconfig.json                    # Server TypeScript configuration
│   ├── tsconfig.lint.json               # TypeScript configuration used by `npm run lint` (includes the tests)
│   ├── vitest.config.ts                 # Vitest configuration (test files run one after another on the shared database)
│   ├── prisma/
│   │   ├── schema.prisma                # Relational data model & PostgreSQL constraints
│   │   └── seed.ts                      # Idempotent synthetic database seed script
│   ├── src/
│   │   ├── shared/                      # Configuration, Prisma singleton, middleware & utils
│   │   ├── modules/                     # Domain modules (auth, patients, schedules, etc.)
│   │   ├── routes/                      # REST API routing (/api/v1)
│   │   ├── app.ts                       # Express application configuration
│   │   └── server.ts                    # HTTP server entrypoint & graceful shutdown
│   └── tests/                           # Sprint-partitioned tests: sprint-1/unit and sprint-1/integration; later sprints add their own folder
├── deploy/                              # Lab 5 Cloud Deployment & CI/CD Automation
│   ├── deploy.sh                        # GCP Cloud Run & Cloud SQL infrastructure setup script
│   ├── release.sh                       # Cloud Run revision deployment by commit SHA digest
│   ├── smoke_test.py                    # Post-deployment live endpoint smoke test
│   ├── teardown.sh                      # Cloud resource cleanup script
│   └── tests/                           # Offline deployment script test suite
├── docs/                                # Technical Documentation & Lab Runbooks
│   ├── auto-deploy.md                   # Auto deploy and rollback guide
│   ├── gcp-cicd-guide.md                # GCP and CI/CD guide
│   ├── gcp-first-lab.md                 # First practice: GCP CLI and Console
│   └── labs/
│       └── lab-05/
│           └── deployment.md            # [Lab 5] Cloud architecture, env vars & release runbook
├── reports/                             # Deliverable reports, built with Node scripts (not LaTeX, see 1.2)
│   ├── template/                        # Unused LaTeX stub, kept for reference (not part of the build)
│   │   ├── preamble.tex
│   │   └── main.tex
│   └── sprint-1/                        # Sprint 1 / Project Deliverable 1
│       ├── Appointly-Deliverable-1.pdf  # The final report (Parts A–F)
│       ├── source/                      # Node scripts, stylesheet and collected evidence data
│       └── figures/                     # Screenshots, terminal figures, logs and code excerpts
└── specs/                               # Engineering Baseline Specifications
    ├── 01-srs-and-product-scope.md      # Part A: Software Requirements Specification (v1.0)
    ├── 02-feature-inventory-traceability.md # Part B: Feature Inventory & Traceability Matrix (v1.0)
    ├── 03-system-level-sds.md           # Part C: System-Level Software Design Specification (v1.0)
    ├── 04-three-sprint-plan.md          # Part D: Three-Sprint Implementation Plan (v1.0)
    ├── api/
    │   └── openapi.yaml                 # OpenAPI 3.1 REST API specification
    └── sprints/
        └── sprint-1-contracts.md        # Part E: Sprint 1 requirements (contracts, acceptance criteria, tests, DoD) (v1.0)
```

### 1.1 Where the Specifications and Sprint Requirements Are

The project specifications are stored in the **[`specs/`](specs/)** folder:

| File | Report part | What it contains |
| :--- | :---: | :--- |
| [`specs/01-srs-and-product-scope.md`](specs/01-srs-and-product-scope.md) | A | Software Requirements Specification: actors, scope, functional (`FR`), business (`BR`) and non-functional (`NFR`) requirements, decisions |
| [`specs/02-feature-inventory-traceability.md`](specs/02-feature-inventory-traceability.md) | B | The 19 features (`F-001` to `F-019`), traceability matrices, approved baseline changes |
| [`specs/03-system-level-sds.md`](specs/03-system-level-sds.md) | C | System design: architecture, data model, API/UI conventions, RBAC, security, environments |
| [`specs/04-three-sprint-plan.md`](specs/04-three-sprint-plan.md) | D | Roadmap of the three sprints, dependencies and the deliverable checklist |
| [`specs/sprints/sprint-1-contracts.md`](specs/sprints/sprint-1-contracts.md) | E | **The Sprint 1 requirements** (see below) |
| [`specs/api/openapi.yaml`](specs/api/openapi.yaml) | – | OpenAPI 3.1 specification of the REST API |

**The sprint requirements are in `specs/sprints/sprint-1-contracts.md`.** For Sprint 1 (`F-001` to `F-007`) it defines:

1. the feature contracts (what each feature must do),
2. the measurable acceptance criteria (`AC-F001-*` to `AC-F007-*`, with positive, negative and boundary cases),
3. the software test specification (`STS-S1-001` to `STS-S1-009`), which maps every test case to its criteria,
4. the Definition of Done for Sprint 1.

The contracts of the later sprints are planned to be added to the same `specs/sprints/` folder. Which features belong to which sprint is described in `specs/04-three-sprint-plan.md`.

### 1.2 How the Deliverable Report Is Produced (No LaTeX)

The Project Deliverable 1 report is **not** written in LaTeX. The files in `reports/template/` are an unused stub. The report is produced by Node scripts in `reports/sprint-1/source/`:

1. **Collect the data.** Scripts read the test results and the AC/STS traceability (`collect-evidence.mjs`), the GitHub issues, pull requests, CI runs and release tag (`collect-github.mjs`), and capture the screenshots, API calls, database output and terminal figures from the running system. The results are stored under `reports/sprint-1/source/evidence/` and `reports/sprint-1/figures/`.
2. **Convert HTML to PDF.** `build.mjs` turns Parts A–E (the Markdown files in `specs/`) and Part F (the collected evidence) into one HTML page with a stylesheet, then prints that page to PDF with Chromium through Playwright. The result is `reports/sprint-1/Appointly-Deliverable-1.pdf`.
3. **Merge to GitHub.** The scripts, figures and the PDF are committed on a docs branch and merged by pull requests (docs branch → `sprint-1-staging` → `main`). The release tag `v0.1.0-sprint1` stays on the code release commit.

```bash
cd reports/sprint-1/source
npm install                    # once: marked, highlight.js and the IBM Plex fonts
node collect-github.mjs        # refresh the GitHub data
node build.mjs                 # writes ../Appointly-Deliverable-1.pdf
```

See [`reports/sprint-1/source/README.md`](reports/sprint-1/source/README.md) for all collection and capture scripts.

---

## 2. Prerequisites

Ensure the following tools are installed on your local development machine:

* **Node.js:** `v20.x LTS` or higher (tested on Node.js 24)
* **npm:** `v10.x` or higher
* **PostgreSQL:** `16.x` (or Docker for running PostgreSQL container)
* **Docker & Docker Compose:** Optional for local development; required for containerized runs

---

## 3. Environment Configuration (`.env`)

Appointly strictly adheres to the Twelve-Factor App methodology. All configuration and secrets are read from environment variables and must **never** be committed to Git.

### 3.1 Environment Setup

1. **Root & Docker Compose:**
   ```bash
   cp .env.example .env
   ```

2. **Backend Server (`server/`):**
   ```bash
   cp server/.env.example server/.env
   ```

3. **Frontend Client (`client/`):**
   ```bash
   cp client/.env.example client/.env
   ```

### 3.2 Key Environment Variables (SDS Section 8.2)

| Variable Name | Scope | Secret? | Default / Example | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| `NODE_ENV` | Backend | No | `development` | Runtime environment (`development`, `test`, `production`) |
| `PORT` | Backend | No | `4000` | HTTP listening port (Cloud Run defaults to `8080` or `3000`) |
| `DATABASE_URL` | Backend | **Yes** | `postgresql://appointly:appointly_dev_secret@localhost:5432/appointly?schema=public` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Backend | **Yes** | `your_super_secret_access_jwt_key_...` | Cryptographic secret for signing 15-minute access tokens |
| `JWT_REFRESH_SECRET` | Backend | **Yes** | `your_super_secret_refresh_jwt_key_...` | Cryptographic secret for signing 7-day refresh tokens |
| `CORS_ORIGIN` | Backend | No | `http://localhost:5173` | Allowed frontend origin for CORS credentials |
| `COOKIE_SECURE` | Backend | No | `false` | `false` on HTTP localhost, `true` in HTTPS production |
| `CLINIC_TIMEZONE` | Backend | No | `Asia/Bangkok` | Clinic IANA timezone read by the server configuration; takes precedence over `CLINIC_DEFAULT_TIMEZONE` |
| `CLINIC_DEFAULT_TIMEZONE` | Backend | No | `Asia/Bangkok` | Fallback used when `CLINIC_TIMEZONE` is not set |
| `LOGIN_RATE_LIMIT_MAX_PER_ACCOUNT` | Backend | No | `10` | Failed sign-ins per e-mail per window before `429 TOO_MANY_REQUESTS` (SDS 7.1) |
| `LOGIN_RATE_LIMIT_MAX_PER_IP` | Backend | No | `100` | Failed sign-ins per client IP per window |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES` | Backend | No | `15` | Length of the sliding window |
| `TRUST_PROXY` | Backend | No | `0` | Reverse proxies in front of the API (`1` on Cloud Run / nginx) so the limiter sees the real client IP |
| `SEED_ADMIN_EMAIL` | Backend | No | `admin@appointly.local` | Seed administrator account email |
| `SEED_DEFAULT_PASSWORD` | Backend | **Yes** (dev/CI) | `ChangeMe123!` | Shared password for the seeded admin and demo/test accounts outside production |
| `ADMIN_PASSWORD` | Backend | **Yes** (production) | — | Production admin password. Used **only** for the admin account, never for demo/test accounts |
| `SEED_DEMO_DATA` | Backend | No | off in production | Set `true` to seed demo doctors/patients in production (always seeded outside production) |
| `DEMO_USER_PASSWORD` | Backend | When `SEED_DEMO_DATA=true` in production | — | Dedicated password for demo/test accounts; must differ from `ADMIN_PASSWORD` |
| `VITE_API_BASE_URL` | Frontend | No | `http://localhost:4000/api/v1` | Base REST API URL consumed by Vite frontend |
| `VITE_API_URL` | Frontend | No | `http://localhost:4000` | API base URL for Nginx proxy |

> [!NOTE]
> **Timezone in Sprint 1:** the application logic uses the fixed clinic timezone `Asia/Bangkok` (decision `DEC-016`; all timestamps are stored in UTC). The two timezone variables above are read into the configuration but do not change behaviour yet.

> [!NOTE]
> In production (GCP Cloud Run), sensitive secrets (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SEED_DEFAULT_PASSWORD`) are loaded securely via **GCP Secret Manager** and mounted into the container at runtime.

---

## 4. Dependency Installation

To install all workspace dependencies across the monorepo:

```bash
# Install dependencies across all monorepo packages (Root, Server, and Client)
npm install
```

Alternatively, install dependencies inside individual project directories:

```bash
# Server dependencies only
cd server && npm install

# Client dependencies only
cd client && npm install
```

---

## 5. Database Setup, Migrations & Seeding

### 5.1 Start Local PostgreSQL via Docker

If you do not have a local PostgreSQL 16 server running, start one with Docker Compose:

```bash
# Start PostgreSQL database in detached mode
docker compose up db -d
```

### 5.2 Generate Prisma Client

```bash
# From repository root:
npm run prisma:generate

# Or inside server/:
cd server && npx prisma generate
```

### 5.3 Apply Migrations

```bash
# Apply pending migrations locally:
npm run prisma:migrate

# In CI/CD or production environments:
npm run prisma:deploy --workspace=server
```

### 5.4 Seed Initial Data

Populates default clinic settings and synthetic test records:

```bash
# From repository root:
npm run prisma:seed

# Or inside server/:
cd server && npm run prisma:seed
```

---

## 6. Running the Application Locally

### 6.1 Development Mode (Hot-Reload)

Run the backend API and frontend Vite server concurrently:

```bash
# Option A: Start both services concurrently using npm workspaces
npm run dev:server
npm run dev:client

# Option B: Run each in a separate terminal window
# Terminal 1 (Backend on http://localhost:4000):
cd server && npm run dev

# Terminal 2 (Frontend on http://localhost:5173):
cd client && npm run dev
```

* **Frontend Web App:** [http://localhost:5173](http://localhost:5173)
* **Backend API Health Check:** [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

### 6.2 Full Containerized Mode (Docker Compose)

To build and run the entire stack (PostgreSQL, migration job, backend API, and Nginx frontend) in isolated Docker containers:

```bash
docker compose up --build
```

---

## 7. Running Tests

### 7.1 Automated Monorepo Test Suite

Run all test suites across the monorepo:

```bash
# Run tests for both server and client:
npm test

# Static checks (ESLint + strict TypeScript, no unused code) for both packages:
npm run lint
```

### 7.2 Workspace-Specific Tests

```bash
# Run server test suite (Vitest + Supertest API checks):
npm run test:server

# Run client test suite (Vitest + React Testing Library):
npm run test:client
```

Tests are organised by tier under each package's `tests/sprint-N/` folder
(Sprint 1 Contracts section 3.1):

| Tier | Location | Needs |
| :--- | :--- | :--- |
| Unit (pure functions) | `server/tests/sprint-1/unit/` | nothing |
| Integration (real app, real PostgreSQL) | `server/tests/sprint-1/integration/` | a migrated and seeded database |
| Component / UI | `client/tests/sprint-1/*.test.tsx` | nothing (API mocked) |
| End-to-end (real browser) | `client/tests/sprint-1/e2e/` | see 7.3 |

The server integration tests change data: point `DATABASE_URL` at a disposable database
(for example `appointly_test`), then `npx prisma migrate reset --force` and `npx prisma db seed` for a clean state.

### 7.3 End-to-End Tests (Playwright)

Three browser journeys cover the Sprint 1 acceptance criteria against the real API and a seeded database.
They are not part of `npm test` or CI. Details: [`client/tests/sprint-1/e2e/README.md`](client/tests/sprint-1/e2e/README.md).

```bash
npx playwright install chromium     # first time only (run inside client/)
# DATABASE_URL must point at a disposable database whose name ends in _test
npm run test:e2e
```

### 7.4 Deployment Scripts Verification

To test deployment automation scripts locally (does not require GCP access):

```bash
python -m unittest discover -s deploy/tests -p 'test_smoke.py'
```

---

## 8. Cloud Deployment & Lab 5 Reference

For Google Cloud Platform deployment instructions, Cloud Run topologies, and CI/CD workflow configurations, refer to:

* [Lab 5 Deployment Runbook](docs/labs/lab-05/deployment.md)
* [System-Level SDS Section 8](specs/03-system-level-sds.md#L627)
* [Sprint 1 Engineering Contracts](specs/sprints/sprint-1-contracts.md)
