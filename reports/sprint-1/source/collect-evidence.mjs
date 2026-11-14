// ==============================================================================
// Appointly - Deliverable 1 evidence collector
// ==============================================================================
// Condenses the raw JSON reports of the three test tiers, the Sprint 1 Contracts
// (AC / STS ids) and the git history into `evidence/evidence.json`, which build.mjs
// renders as Part F. Nothing here is typed in by hand.
//
//   node collect-evidence.mjs <server-vitest.json> <client-vitest.json> <playwright.json>
//
// Produce the three reports first (DATABASE_URL must point at a disposable *_test DB):
//   server/ : npx vitest run --reporter=json --outputFile=<server-vitest.json>
//   client/ : npx vitest run --reporter=json --outputFile=<client-vitest.json>
//   client/ : PLAYWRIGHT_JSON_OUTPUT_NAME=<playwright.json> npx playwright test --reporter=json
// ==============================================================================

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const [serverJson, clientJson, e2eJson] = process.argv.slice(2);
if (!serverJson || !clientJson || !e2eJson) {
  console.error('usage: node collect-evidence.mjs <server-vitest.json> <client-vitest.json> <playwright.json>');
  process.exit(1);
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const rel = (p) => relative(repo, p).replaceAll('\\', '/');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

// ---- vitest -> per-file rows -------------------------------------------------
function vitestRows(json, pkg) {
  return json.testResults
    .map((file) => {
      const path = rel(file.name);
      const tests = file.assertionResults;
      const count = (s) => tests.filter((t) => t.status === s).length;
      const tier = path.includes('/unit/') ? 'Unit' : pkg === 'server' ? 'Integration (API + PostgreSQL)' : 'Component / UI';
      return {
        package: pkg,
        tier,
        file: path.replace(/^(server|client)\/tests\/sprint-1\//, ''),
        path,
        total: tests.length,
        passed: count('passed'),
        failed: count('failed'),
        skipped: count('skipped') + count('pending') + count('todo'),
        ms: Math.round(file.endTime - file.startTime),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

// ---- playwright -> per-test rows -----------------------------------------------
function e2eRows(json) {
  const rows = [];
  (function walk(suite, journey) {
    const name = suite.title && !suite.title.endsWith('.ts') ? suite.title : journey;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results[t.results.length - 1];
        rows.push({
          journey: name,
          title: spec.title,
          status: last.status === 'passed' ? 'passed' : last.status,
          ms: last.duration,
        });
      }
    }
    for (const s of suite.suites ?? []) walk(s, name);
  })({ suites: json.suites }, '');
  return rows;
}

// ---- contracts: AC + STS ------------------------------------------------------------
const contract = readFileSync(join(repo, 'specs/sprints/sprint-1-contracts.md'), 'utf8').split(/\r?\n/);
const acs = [];
let feature = '';
for (const line of contract) {
  const h = line.match(/^### 2\.\d+ (F-\d+: .+)$/);
  if (h) feature = h[1];
  const m = line.match(/^\* \*\*(AC-F\d+-\d+) \(([^)]+)\)/);
  if (m) acs.push({ id: m[1], kind: m[2].split(/ [-—] /)[0].trim(), label: m[2].trim(), feature });
}
const sts = [];
for (const line of contract) {
  const m = line.match(/^\| \*\*(STS-S1-\d+)\*\* \| ([^|]+) \| ([^|]+) \|/);
  if (m) sts.push({ id: m[1], acs: m[2].trim(), level: m[3].trim() });
}

// ---- which test files exercise which AC / STS (the id appears in the file) -------------
function* walkFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules') yield* walkFiles(p);
    } else if (/\.(test|spec)\.tsx?$/.test(name)) yield p;
  }
}
const files = [...walkFiles(join(repo, 'server/tests')), ...walkFiles(join(repo, 'client/tests'))].map((p) => ({
  path: rel(p),
  text: readFileSync(p, 'utf8'),
}));

const server = vitestRows(read(serverJson), 'server');
const client = vitestRows(read(clientJson), 'client');
const e2e = e2eRows(read(e2eJson));

const countFor = (path) => {
  const row = [...server, ...client].find((r) => r.path === path);
  if (row) return row.total;
  if (path.includes('/e2e/')) return e2e.length;
  return 0;
};
const mentions = (id) =>
  files
    .filter((f) => f.text.includes(id))
    .map((f) => ({ path: f.path, tests: countFor(f.path) }))
    .sort((a, b) => a.path.localeCompare(b.path));

const acRows = acs.map((a) => ({ ...a, files: mentions(a.id) }));
const stsRows = sts.map((s) => ({ ...s, files: mentions(s.id) }));

// ---- git ----------------------------------------------------------------------------------
// (issues, pull requests and CI runs come from collect-github.mjs)

const sum = (rows, k) => rows.reduce((n, r) => n + r[k], 0);
const evidence = {
  generatedAt: new Date().toISOString(),
  git: { branch: git('rev-parse', '--abbrev-ref', 'HEAD'), commit: git('rev-parse', '--short', 'HEAD') },
  suites: { server, client },
  e2e,
  totals: {
    server: { files: server.length, tests: sum(server, 'total'), passed: sum(server, 'passed'), failed: sum(server, 'failed') },
    client: { files: client.length, tests: sum(client, 'total'), passed: sum(client, 'passed'), failed: sum(client, 'failed') },
    e2e: { tests: e2e.length, passed: e2e.filter((t) => t.status === 'passed').length, failed: e2e.filter((t) => t.status !== 'passed').length },
  },
  acs: acRows,
  sts: stsRows,
};

mkdirSync(join(here, 'evidence'), { recursive: true });
writeFileSync(join(here, 'evidence/evidence.json'), JSON.stringify(evidence, null, 2));
console.log('evidence.json written:', JSON.stringify(evidence.totals));
console.log('ACs:', acRows.length, '(uncovered:', acRows.filter((a) => a.files.length === 0).map((a) => a.id).join(', ') || 'none', ')');
console.log('STS:', stsRows.length);
