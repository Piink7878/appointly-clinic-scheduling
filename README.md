# Appointly — Clinic Appointment & Scheduling Management System

Appointly is a comprehensive, three-tier responsive web application designed for single-clinic operations. It provides role-scoped portals for **Patients**, **Doctors**, and **Clinic Administrators**, supporting end-to-end appointment scheduling, conflict-free doctor working hours management, and clinic configuration.

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
│   ├── src/                             # Domain-partitioned frontend source tree
│   │   ├── shared/                      # Shared API client, UI components, context & utils
│   │   ├── modules/                     # S1–S3 domain modules (auth, patients, doctors, etc.)
│   │   └── router/                      # Role-protected route definitions
│   └── tests/                           # Sprint-partitioned test suite (sprint-1, sprint-2, sprint-3)
├── server/                              # Application Layer (Node.js + Express + TypeScript + Prisma)
│   ├── .env.example                     # Backend runtime environment variables
│   ├── Dockerfile                       # Backend container definition
│   ├── docker-entrypoint.sh             # Graceful SIGTERM container entrypoint
│   ├── package.json                     # Server dependencies & scripts
│   ├── tsconfig.json                    # Server TypeScript configuration
│   ├── prisma/
│   │   ├── schema.prisma                # Relational data model & PostgreSQL constraints
│   │   └── seed.ts                      # Idempotent synthetic database seed script
│   ├── src/
│   │   ├── shared/                      # Configuration, Prisma singleton, middleware & utils
│   │   ├── modules/                     # Domain modules (auth, patients, schedules, etc.)
│   │   ├── routes/                      # REST API routing (/api/v1)
│   │   ├── app.ts                       # Express application configuration
│   │   └── server.ts                    # HTTP server entrypoint & graceful shutdown
│   └── tests/                           # Sprint-partitioned test suite (sprint-1, sprint-2, sprint-3)
├── deploy/                              # Lab 5 Cloud Deployment & CI/CD Automation
│   ├── deploy.sh                        # GCP Cloud Run & Cloud SQL infrastructure setup script
│   ├── release.sh                       # Cloud Run revision deployment by commit SHA digest
│   ├── smoke_test.py                    # Post-deployment live endpoint smoke test
│   ├── teardown.sh                      # Cloud resource cleanup script
│   └── tests/                           # Offline deployment script test suite
├── docs/                                # Technical Documentation & Lab Runbooks
│   └── labs/
│       └── lab-05/
│           └── deployment.md            # [Lab 5] Cloud architecture, env vars & release runbook
├── reports/                             # LaTeX Academic Deliverable Reports
│   ├── template/
│   │   ├── preamble.tex                 # XeLaTeX preamble (TH Sarabun New font, code blocks, tables)
│   │   └── main.tex                     # Report template document
│   └── sprint-1/                        # Sprint 1 report deliverables
└── specs/                               # Engineering Baseline Specifications
    ├── 01-srs-and-product-scope.md      # Part A: Software Requirements Specification (v1.0)
    ├── 02-feature-inventory-traceability.md # Part B: Feature Inventory & Traceability Matrix (v1.0)
    ├── 03-system-level-sds.md           # Part C: System-Level Software Design Specification (v1.0)
    ├── 04-three-sprint-plan.md          # Part D: Three-Sprint Implementation Plan (v1.0)
    ├── api/
    │   └── openapi.yaml                 # OpenAPI 3.1 REST API specification
    └── sprints/
        └── sprint-1-contracts.md        # Part E: Sprint 1 Engineering Contracts (v1.0)
```

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
| `CLINIC_DEFAULT_TIMEZONE` | Backend | No | `Asia/Bangkok` | Default clinic timezone for slot calculation & display |
| `SEED_ADMIN_EMAIL` | Backend | No | `admin@appointly.local` | Seed administrator account email |
| `SEED_DEFAULT_PASSWORD` | Backend | **Yes** | `ChangeMe123!` | Seed test account initial password |
| `VITE_API_BASE_URL` | Frontend | No | `http://localhost:4000/api/v1` | Base REST API URL consumed by Vite frontend |
| `VITE_API_URL` | Frontend | No | `http://localhost:4000` | API base URL for Nginx proxy |

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
```

### 7.2 Workspace-Specific Tests

```bash
# Run server test suite (Vitest + Supertest API checks):
npm run test:server

# Run client test suite (Vitest + React Testing Library):
npm run test:client
```

### 7.3 Deployment Scripts Verification

To test deployment automation scripts locally (does not require GCP access):

```bash
python -m unittest discover -s deploy/tests -p 'test_smoke.py'
```

---

## 8. Cloud Deployment & Lab 5 Reference

For Google Cloud Platform deployment instructions, Cloud Run topologies, and CI/CD workflow configurations, refer to:

* [Lab 5 Deployment Runbook](file:///d:/modcom/CPE334_SE/lab05/toktickit-lab5-starter/docs/labs/lab-05/deployment.md)
* [System-Level SDS Section 8](file:///d:/modcom/CPE334_SE/lab05/toktickit-lab5-starter/specs/03-system-level-sds.md#L627)
* [Sprint 1 Engineering Contracts](file:///d:/modcom/CPE334_SE/lab05/toktickit-lab5-starter/specs/sprints/sprint-1-contracts.md)
