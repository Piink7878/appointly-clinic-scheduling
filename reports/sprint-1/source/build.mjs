// ==============================================================================
// Appointly - CPE 334 Project Deliverable 1 - PDF builder
// ==============================================================================
// Markdown specs (Parts A-E) + collected evidence (Part F)  ->  HTML  ->  PDF.
//
//   npm install                     (once, in this folder: marked, highlight.js and the IBM Plex fonts)
//   node collect-evidence.mjs <server.json> <client.json> <playwright.json>   (test results, AC/STS traceability)
//   node collect-github.mjs         (issues, pull requests, CI runs, release tag)
//   node build.mjs                  (writes ../Appointly-Deliverable-1.pdf; the intermediate HTML stays in this folder)
//
// The PDF is printed by the Chromium that ships with Playwright (already a dev dependency of the client),
// so no LaTeX installation is needed. Body text is IBM Plex Sans Thai (Latin + Thai), code is IBM Plex Mono;
// both come from npm packages so the result does not depend on installed fonts.
// Page numbers of the table of contents are measured, not typed: every part starts on a new page, so each
// part is printed on its own once to count its pages, then the real print runs.
// ==============================================================================

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Marked } from 'marked';
import hljs from 'highlight.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const figures = resolve(here, '../figures');
const { chromium } = createRequire(join(repo, 'package.json'))('playwright-core');

const OUT_HTML = join(here, 'Appointly-Deliverable-1.html');
const OUT_PDF = resolve(here, '../Appointly-Deliverable-1.pdf');

// --- parts -------------------------------------------------------------------------------------
const PARTS = [
  { id: 'a', letter: 'A', title: 'Software Requirements Specification & Product Scope', file: 'specs/01-srs-and-product-scope.md' },
  { id: 'b', letter: 'B', title: 'Feature Inventory & Traceability', file: 'specs/02-feature-inventory-traceability.md' },
  { id: 'c', letter: 'C', title: 'System-Level Software Design Specification (SDS)', file: 'specs/03-system-level-sds.md' },
  { id: 'd', letter: 'D', title: 'Three-Sprint Implementation Plan', file: 'specs/04-three-sprint-plan.md' },
  { id: 'e', letter: 'E', title: 'Sprint 1 Engineering Contracts', file: 'specs/sprints/sprint-1-contracts.md' },
  { id: 'f', letter: 'F', title: 'Sprint 1 Working Release – Evidence', file: null },
];
const FILE_TO_PART = Object.fromEntries(PARTS.filter((p) => p.file).map((p) => [p.file.split('/').pop(), p.id]));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const warnings = [];

// --- markdown -> HTML -------------------------------------------------------------------------------
const marked = new Marked({ gfm: true, breaks: false });
const BOX = /[─-╿▲-▼]/;

function highlight(text, lang) {
  if (lang && hljs.getLanguage(lang)) return hljs.highlight(text, { language: lang }).value;
  return esc(text);
}

marked.use({
  renderer: {
    code({ text, lang }) {
      const language = (lang || '').trim().split(/\s+/)[0];
      const lines = text.replace(/\n$/, '').split('\n');
      const longest = Math.max(...lines.map((l) => [...l].length));
      const keep = lines.length <= 58 ? ' keep' : ''; // short blocks are never split across pages
      if (language === 'text' || (!language && (BOX.test(text) || /^\+-/m.test(text)))) {
        // ASCII diagram / plain text: never re-wrap it; shrink the font until the longest line fits (462pt of box width, IBM Plex Mono = 0.6em per glyph).
        const size = Math.min(7.4, Math.floor((462 / (longest * 0.61)) * 10) / 10);
        if (size < 5.2) warnings.push(`diagram line of ${longest} chars needs ${size}pt`);
        return `<pre class="diagram${keep}" style="font-size:${size}pt"><code>${esc(text)}</code></pre>\n`;
      }
      return `<pre class="${keep.trim()}"><code class="hljs">${highlight(text, language)}</code></pre>\n`;
    },
  },
});

function renderMarkdown(source) {
  let html = marked.parse(source.replace(/^﻿/, '').replace(/\r\n/g, '\n'));

  // tables: styled class, denser when there are many columns
  html = html.replace(/<table>([\s\S]*?)<\/table>/g, (_, inner) => {
    const cols = (inner.match(/<th[ >]/g) || []).length;
    return `<table class="md${cols >= 6 ? ' dense' : ''}">${inner}</table>`;
  });
  // GitHub alerts  > [!NOTE]
  html = html.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:<br\s*\/?>)?\s*/g,
    (_, kind) => `<blockquote class="${kind.toLowerCase()}"><p><span class="callout-title">${kind}</span><br>`,
  );
  // links to sibling spec files become jumps to the matching part; in-document anchors lose the link
  html = html.replace(/<a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (all, href, rest, label) => {
    const [file] = href.split('#');
    const base = file.split('/').pop();
    if (FILE_TO_PART[base]) return `<a href="#part-${FILE_TO_PART[base]}">${label}</a>`;
    if (href.startsWith('#') || /\.md$/.test(file)) return label;
    return all;
  });
  return html;
}

function partFromMarkdown(part) {
  const raw = readFileSync(join(repo, part.file), 'utf8');
  const stripped = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const title = (stripped.match(/^# (.+)$/m) || [])[1] || part.title;
  // the document title is replaced by the part title; the closing rule + "End of ..." line becomes a compact footer note
  const body = stripped.replace(/^# .+\n/, '').replace(/\n+(?:---\n+)?\*End of [^\n]+\*\s*$/, '\n');
  const end = (stripped.match(/\n\*(End of [^\n]+)\*\s*$/) || [])[1];
  return { title, html: renderMarkdown(body) + (end ? `<p class="end">${esc(end)}</p>` : '') };
}

// --- evidence (Part F) ---------------------------------------------------------------------------------------
const readJson = (rel, hint) => {
  const p = join(here, rel);
  if (!existsSync(p)) {
    console.error(`${rel} is missing - run ${hint} first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
};
const ev = readJson('evidence/evidence.json', 'collect-evidence.mjs');
const gh = readJson('evidence/github.json', 'collect-github.mjs');
const logText = (name) => readFileSync(join(figures, 'logs', name), 'utf8').replace(/\r/g, '');

/**
 * A code excerpt: the doc comment above a declaration plus the declaration itself, up to its closing brace
 * (the first line after the start that has the same indentation as the declaration and is just "}").
 */
function excerpt(relPath, startMarker) {
  const lines = readFileSync(join(repo, relPath), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.includes(startMarker));
  if (start < 0) throw new Error(`marker not found: ${startMarker}`);
  let from = start;
  if (lines[from - 1]?.trim() === '*/') {
    from -= 1;
    while (from > 0 && !lines[from].trim().startsWith('/**')) from -= 1;
  }
  const indent = lines[start].match(/^\s*/)[0];
  let to = start;
  while (to < lines.length && lines[to] !== `${indent}}`) to += 1;
  return { code: lines.slice(from, to + 1).join('\n'), first: from + 1, range: `${from + 1}–${to + 1}`, path: relPath };
}

const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);
const result = (ok) => (ok ? 'Pass' : 'Fail');
const shortPath = (p) => p.replace(/^(server|client)\/tests\/sprint-1\//, '$1/');

let tblNo = 0;
let accountsNo = 0;
let figNo = 0;
let lstNo = 0;
const tcap = (text) => `<p class="tcap">Table F.${++tblNo} — ${text}</p>`;

function suiteTable(title, rows) {
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  const body = rows
    .map(
      (r) =>
        `<tr><td><code>${esc(r.file)}</code></td><td class="num">${r.total}</td><td class="num">${r.passed}</td><td class="num">${r.failed}</td><td class="num nw">${fmtMs(r.ms)}</td></tr>`,
    )
    .join('');
  return `${tcap(title)}
<table class="md dense"><thead><tr><th>Test file</th><th class="num">Tests</th><th class="num">Passed</th><th class="num">Failed</th><th class="num nw">Time</th></tr></thead>
<tbody>${body}<tr class="total"><td>Subtotal (${rows.length} files)</td><td class="num">${sum('total')}</td><td class="num">${sum('passed')}</td><td class="num">${sum('failed')}</td><td></td></tr></tbody></table>`;
}

/** One or more images that belong together, with the figure caption underneath. Every image must exist. */
function figure(files, caption) {
  const list = Array.isArray(files) ? files : [files];
  const imgs = list
    .map((f) => {
      if (!existsSync(join(figures, f))) throw new Error(`missing figure file: ${f}`);
      return `<img src="${pathToFileURL(join(figures, f)).href}" alt="${esc(caption)}">`;
    })
    .join('\n');
  return `<figure class="figure${list.length > 1 ? ' stack' : ''}">${imgs}\n<figcaption>Figure F.${++figNo} — ${caption}</figcaption></figure>`;
}

/** A code excerpt: file name and line range on top, the real line numbers in a gutter, caption underneath. */
function excerptBox(ex, caption) {
  const count = ex.code.split('\n').length;
  const gutter = Array.from({ length: count }, (_, i) => ex.first + i).join('\n');
  // never wrap (the gutter must stay aligned): shrink the font so the longest line fits the ~430pt left of the box
  const longest = Math.max(...ex.code.split('\n').map((l) => [...l].length));
  const size = Math.min(7.8, Math.floor((430 / (longest * 0.61)) * 10) / 10);
  const style = ` style="font-size:${size}pt"`;
  return `<figure class="figure"><div class="excerpt"><div class="head"><span>${esc(ex.path)}</span><span>lines ${ex.range}</span></div>
<div class="body"><pre class="gutter"${style}>${gutter}</pre><pre${style}><code class="hljs">${highlight(ex.code, 'typescript')}</code></pre></div></div>
<figcaption>Listing F.${++lstNo} — ${caption}</figcaption></figure>`;
}

const bangkokDate = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const minutes = (a, b) => {
  const s = Math.round((new Date(b) - new Date(a)) / 1000);
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
};

function partF() {
  tblNo = 0;
  figNo = 0;
  lstNo = 0;

  const t = ev.totals;
  const total = t.server.tests + t.client.tests + t.e2e.tests;
  const passed = t.server.passed + t.client.passed + t.e2e.passed;
  const failed = t.server.failed + t.client.failed + t.e2e.failed;
  const unitRows = ev.suites.server.filter((r) => r.tier === 'Unit');
  const integRows = ev.suites.server.filter((r) => r.tier !== 'Unit');
  const failedFiles = new Set([...ev.suites.server, ...ev.suites.client].filter((r) => r.failed > 0).map((r) => r.path));
  const e2eOk = t.e2e.failed === 0;
  const fileOk = (p) => (p.includes('/e2e/') ? e2eOk : !failedFiles.has(p));
  const covered = (rows) => rows.filter((r) => r.files.length && r.files.every((f) => fileOk(f.path))).length;
  if (failed > 0) warnings.push(`${failed} automated tests failed in the evidence run`);
  if (covered(ev.acs) !== ev.acs.length || covered(ev.sts) !== ev.sts.length) warnings.push('not every AC / STS is covered by a passing test');

  const pgVersion = (logText('12-db-evidence.log').match(/PostgreSQL (\d+\.\d+)/) || [])[1] || '16';
  const playwrightVersion = (JSON.parse(readFileSync(join(repo, 'client/package-lock.json'), 'utf8')).packages['node_modules/@playwright/test'] || {}).version || '';
  const release = gh.release;
  // the release pull request is the one whose merge commit carries the tag; its last successful CI run is the release evidence
  const releasePr = gh.prs.find((p) => p.mergeCommit === release.commit);
  const successRun = gh.ciRuns.find((r) => r.conclusion === 'success' && r.pr === releasePr.number);

  const acRows = ev.acs
    .map((a) => {
      const files = a.files.map((f) => `<code>${esc(shortPath(f.path))}</code> (${f.tests})`).join('<br>');
      const ok = a.files.length > 0 && a.files.every((f) => fileOk(f.path));
      return `<tr><td class="nw"><code>${a.id}</code></td><td>${esc(a.kind)}</td><td>${esc(a.feature.split(':')[0])}</td><td>${files || '<i>no automated test found</i>'}</td><td class="nw">${a.files.length ? result(ok) : 'Gap'}</td></tr>`;
    })
    .join('');
  const stsRows = ev.sts
    .map((s) => {
      const files = s.files.map((f) => `<code>${esc(shortPath(f.path))}</code>`).join('<br>');
      const ok = s.files.length > 0 && s.files.every((f) => fileOk(f.path));
      return `<tr><td class="nw"><code>${s.id}</code></td><td>${esc(s.acs)}</td><td>${esc(s.level)}</td><td>${files || '–'}</td><td class="nw">${s.files.length ? result(ok) : 'Gap'}</td></tr>`;
    })
    .join('');
  const e2eRows = ev.e2e
    .map(
      (e, i) =>
        `<tr><td class="num">${i + 1}</td><td>${esc(e.journey.replace(/ \(F-[^)]*\)$/, ''))}</td><td>${esc(e.title)}</td><td class="nw">${result(e.status === 'passed')}</td><td class="num nw">${fmtMs(e.ms)}</td></tr>`,
    )
    .join('');

  // seeded accounts, read from the psql output of the database evidence
  const accounts = [...logText('12-db-evidence.log').matchAll(/^\s*(\S+@appointly\.local)\s+\|\s+(\w+)\s+\|\s+(\w+)\s+\|/gm)].map((m) => ({ email: m[1], role: m[2], status: m[3] }));
  if (accounts.length !== 6) warnings.push(`expected 6 seeded accounts in the database evidence, found ${accounts.length}`);
  const accountRows = accounts.map((a) => `<tr><td><code>${esc(a.email)}</code></td><td>${a.role}</td><td>${a.status}</td></tr>`).join('');

  // GitHub history
  const issueRows = gh.issues
    .map((i) => `<tr><td class="nw">#${i.number}</td><td>${esc(i.title)}</td><td class="nw">${i.state === 'closed' ? 'Closed' : 'Open'}</td><td class="nw">${i.closed || '–'}</td></tr>`)
    .join('');
  const prRows = gh.prs
    .map(
      (p) =>
        `<tr><td class="nw">#${p.number}</td><td>${esc(p.title.replace(/^\[Sprint 1\]\s*/, ''))}</td><td><code>${esc(p.head)}</code> → <code>${esc(p.base)}</code></td><td class="nw">${p.merged}</td><td class="nw"><code>${p.mergeCommit.slice(0, 7)}</code></td></tr>`,
    )
    .join('');
  const prByHead = (head) => gh.prs.find((p) => p.head === head);
  const ciRows = [...gh.ciRuns]
    .reverse()
    .map((r) => {
      const prNo = r.pr ?? prByHead(r.branch)?.number;
      return `<tr><td class="nw"><code>${r.id}</code></td><td class="nw">${prNo ? '#' + prNo : '–'}</td><td><code>${esc(r.branch)}</code></td><td class="nw"><code>${r.sha}</code></td><td class="nw">${r.conclusion === 'success' ? 'Success' : 'Failure'}</td><td class="num nw">${minutes(r.started, r.finished)}</td></tr>`;
    })
    .join('');

  const ex1 = excerpt('server/src/modules/schedules/scheduleValidator.ts', 'export function doShiftsOverlap');
  const ex2 = excerpt('server/src/shared/middleware/roleGuard.ts', 'export function roleGuard');
  const ex3 = excerpt('server/src/shared/utils/security.ts', 'export function setAuthCookies');
  const ex4 = excerpt('server/src/modules/settings/service.ts', 'async updateSettings(');
  const collected = new Date(ev.generatedAt).toLocaleDateString('en-CA');

  // plain-text copies of the excerpts for the figures folder
  mkdirSync(join(figures, 'code'), { recursive: true });
  [
    ['code-01-overlap-rule.ts.txt', ex1],
    ['code-02-role-guard.ts.txt', ex2],
    ['code-03-auth-cookies.ts.txt', ex3],
    ['code-04-settings-audit.ts.txt', ex4],
  ].forEach(([name, ex]) => writeFileSync(join(figures, 'code', name), `// ${ex.path}, lines ${ex.range}\n${ex.code}\n`));

  return `
<h2>F.1 Release summary</h2>
<p>This part documents the working Sprint 1 release of Appointly (features F-001 to F-007) with evidence collected from the running system,
 the automated test runs and the GitHub repository. Dates are shown in the clinic time zone (Asia/Bangkok, UTC+7).</p>
${tcap('Release and verification summary')}
<table class="md"><thead><tr><th>Item</th><th>Result</th></tr></thead><tbody>
<tr><td>Repository</td><td><code>${esc(gh.repoUrl)}</code></td></tr>
<tr><td>Release tag</td><td><code>${esc(release.tag)}</code> on <code>main</code>, commit <code>${release.shortCommit}</code> (<code>${release.commit}</code>), ${bangkokDate(release.date)}</td></tr>
<tr><td>Tested source revision</td><td><code>sprint-1-staging</code> at commit <code>${esc(ev.git.commit)}</code>; the release merge into <code>main</code> has an identical file tree</td></tr>
<tr><td>Automated tests executed</td><td>${total}</td></tr>
<tr><td>Tests passed / failed</td><td>${passed} / ${failed}</td></tr>
<tr><td>Acceptance criteria with a passing automated test (F-001 to F-007)</td><td>${covered(ev.acs)} of ${ev.acs.length}</td></tr>
<tr><td>STS test cases with a passing automated test</td><td>${covered(ev.sts)} of ${ev.sts.length}</td></tr>
<tr><td>Static checks (<code>npm run lint</code>: ESLint and strict TypeScript, both packages)</td><td>No errors</td></tr>
<tr><td>Production build (<code>npm run build</code>) and production container build (<code>docker build</code>)</td><td>No errors</td></tr>
<tr><td>GitHub Actions workflow “CI &amp; Docker Build” on the release pull request</td><td>Success (run <code>${successRun.id}</code>)</td></tr>
<tr><td>Test environment</td><td>Windows 11, Node.js ${esc(process.version)}, PostgreSQL ${esc(pgVersion)} (<code>postgres:16-alpine</code> container), Chromium through Playwright ${esc(playwrightVersion)}</td></tr>
</tbody></table>
${tcap('Results by test tier')}
<table class="md"><thead><tr><th>Test tier</th><th>Runner</th><th class="num">Files</th><th class="num">Tests</th><th class="num">Passed</th><th class="num">Failed</th></tr></thead><tbody>
<tr><td>Unit and integration (API, real PostgreSQL)</td><td>Vitest and Supertest</td><td class="num">${t.server.files}</td><td class="num">${t.server.tests}</td><td class="num">${t.server.passed}</td><td class="num">${t.server.failed}</td></tr>
<tr><td>Component / UI (API mocked)</td><td>Vitest and React Testing Library</td><td class="num">${t.client.files}</td><td class="num">${t.client.tests}</td><td class="num">${t.client.passed}</td><td class="num">${t.client.failed}</td></tr>
<tr><td>End-to-end (real browser, API and PostgreSQL)</td><td>Playwright (Chromium)</td><td class="num">1</td><td class="num">${t.e2e.tests}</td><td class="num">${t.e2e.passed}</td><td class="num">${t.e2e.failed}</td></tr>
<tr class="total"><td>Total</td><td></td><td class="num">${t.server.files + t.client.files + 1}</td><td class="num">${total}</td><td class="num">${passed}</td><td class="num">${failed}</td></tr>
</tbody></table>

<h2>F.2 Local setup and reproduction</h2>
<p>The release runs locally from a clean checkout, using the steps in the repository README. PostgreSQL 16 is started with Docker Compose,
 the schema is created by the versioned Prisma migration and the demonstration data by the seed script.</p>
<pre class="keep"><code>git clone ${esc(gh.repoUrl)}.git &amp;&amp; cd appointly-clinic-scheduling
git checkout ${esc(release.tag)}
cp .env.example .env &amp;&amp; cp server/.env.example server/.env &amp;&amp; cp client/.env.example client/.env
npm install
docker compose up db -d                          # PostgreSQL 16
npm run prisma:deploy --workspace=server         # versioned migrations
npm run prisma:seed                              # demonstration accounts and clinic defaults
npm run dev:server   &amp;   npm run dev:client      # API and web client
npm run lint &amp;&amp; npm run build &amp;&amp; npm test        # static checks, build, server and client tests
npm run test:e2e                                 # Playwright journeys (database name must end in _test)</code></pre>
<p>The seed creates the six accounts of Table F.${(accountsNo = tblNo + 1)}; all of them share the demonstration password documented in the README
 (it is a development value, not a secret of a deployed system).</p>
${tcap('Accounts created by the seed script')}
<table class="md"><thead><tr><th>Account</th><th>Role</th><th>Status</th></tr></thead><tbody>${accountRows}</tbody></table>
${figure('terminal/term-01-setup-migrate-seed.png', `Applying the Prisma migration and the seed to a fresh PostgreSQL ${esc(pgVersion)} database (<code>prisma migrate reset</code>).`)}

<h2>F.3 Static checks and production build</h2>
<p>Both packages pass the TypeScript compiler in strict mode, ESLint and the production build with no errors or warnings.</p>
${figure('terminal/term-02-typecheck-lint-build.png', 'Type check, lint and production build of the server and the client (all commands exit with status 0).')}

<h2>F.4 Automated test results</h2>
<p>The tests ran against a freshly migrated and seeded PostgreSQL ${esc(pgVersion)} database (figures collected on ${esc(collected)}).
 The server integration tests call the real Express application with Supertest; the end-to-end journeys drive a real Chromium browser against
 the production client bundle, the API and the database. Nothing is mocked in these two tiers.</p>
${suiteTable('Server unit tests (pure functions, no database)', unitRows)}
${suiteTable('Server integration tests (real Express application and PostgreSQL)', integRows)}
${suiteTable('Client component / UI tests (API mocked)', ev.suites.client)}
${tcap(`End-to-end journeys (Playwright, ${t.e2e.tests} tests)`)}
<table class="md dense"><thead><tr><th class="num">#</th><th>Journey</th><th>Scenario</th><th class="nw">Result</th><th class="num nw">Time</th></tr></thead><tbody>${e2eRows}</tbody></table>
${figure('terminal/term-03-server-tests.png', `Server test run: ${t.server.files} files, ${t.server.tests} tests passed (Vitest).`)}
${figure('terminal/term-04-client-tests.png', `Client test run: ${t.client.files} files, ${t.client.tests} tests passed (Vitest and React Testing Library).`)}
${figure('terminal/term-05-e2e-tests.png', `End-to-end run: ${t.e2e.tests} Playwright tests passed in Chromium against the real API and PostgreSQL.`)}

<h3>Regression demonstration for a domain validation rule</h3>
<p>To show that the unit tests detect a defect in the shift-overlap rule (F-006), <code>doShiftsOverlap</code> was deliberately changed to always return
 <code>false</code> and the unit test file was run (red); the file was then restored from Git and the same tests were run again (green).
 This is a demonstration made at release time, not a record of the original development history.</p>
${figure('terminal/term-06-tdd-red-green.png', 'Overlap rule broken on purpose: 4 of 17 tests fail (red); after restoring the rule all 17 tests pass (green).')}

<h2>F.5 Acceptance-criteria-to-test traceability</h2>
<p>Each acceptance criterion of the Sprint 1 Contracts (Part E, section 2) is listed with the automated test files whose source
 names it; the number in brackets is the count of tests in that file. A criterion passes when every one of those files passed in the run above.</p>
${tcap('Acceptance criteria to automated tests')}
<table class="md dense"><thead><tr><th class="nw">Criterion</th><th>Type</th><th>Feature</th><th>Verified by (tests in file)</th><th class="nw">Result</th></tr></thead><tbody>${acRows}</tbody></table>
${tcap('Test-case catalogue (STS, Part E section 3.2)')}
<table class="md dense"><thead><tr><th class="nw">Test ID</th><th>Linked AC</th><th>Level</th><th>Automated evidence</th><th class="nw">Result</th></tr></thead><tbody>${stsRows}</tbody></table>

<h2>F.6 User-interface demonstration</h2>
<p>All screenshots in this section were captured from the running application: the production build of the React client served by the Express API,
 with every request answered by the API and stored in PostgreSQL ${esc(pgVersion)}. No API response is mocked or intercepted. The journeys use the seeded accounts
 of Table F.${accountsNo}, and the steps build on each other (for example, the administrator assigns a service and the patient then finds it).</p>
<h3>F-001 Authentication and role-based access</h3>
${figure('ui/ui-01-login.png', 'The sign-in page (F-001).')}
${figure('ui/ui-02-login-wrong-password.png', 'A wrong password is rejected with a clear message and no session is created (AC-F001-02).')}
${figure('ui/ui-04-rbac-patient-blocked-admin.png', 'A patient who opens the administrator page <code>/admin/doctors</code> is redirected to the 403 page (AC-F001-03).')}
<h3>F-002 Patient profile</h3>
${figure('ui/ui-05-patient-profile-saved.png', 'A patient edits their own profile and saves it (AC-F002-01).')}
${figure('ui/ui-06-patient-profile-after-reload.png', 'After a page reload the profile is loaded again from PostgreSQL (AC-F002-01).')}
${figure('ui/ui-07-admin-patients.png', 'The administrator’s patient directory, available to the ADMIN role only (F-002).')}
<h3>F-003, F-004 and F-005 Doctors, service catalogue and assignment</h3>
${figure('ui/ui-08-admin-doctors.png', 'Administrator doctor management with account status (F-003).')}
${figure('ui/ui-09-admin-service-create-form.png', 'The administrator creates a medical service with a duration of 30 minutes (AC-F004-01).')}
${figure('ui/ui-10-admin-service-created.png', 'The new service appears in the catalogue as Active (AC-F004-01).')}
${figure('ui/ui-11-admin-assign-service-to-doctor.png', 'The administrator assigns the service to an active doctor (AC-F005-01).')}
${figure('ui/ui-03-patient-service-catalogue.png', 'The patient service catalogue lists the active services (F-004).')}
${figure('ui/ui-12-patient-doctors-filtered-by-service.png', 'A patient who filters by the new service sees the doctor assigned to it (AC-F005-03).')}
<h3>F-006 Doctor self-schedule</h3>
${figure(['ui/ui-13a-doctor-schedule-overlap-top.png', 'ui/ui-13b-doctor-schedule-overlap-saturday.png'], 'Negative case: the windows 09:00–13:00 and 12:00–16:00 on Saturday overlap, so saving is refused. The banner is shown at the top of the page (upper image) and the second window is marked on the Saturday card (lower image); nothing is saved (AC-F006-02).')}
${figure(['ui/ui-14a-doctor-schedule-saved-top.png', 'ui/ui-14b-doctor-schedule-saved-saturday.png'], 'Positive case: the split shifts 09:00–12:00 and 13:00–17:00 on Saturday are saved and the confirmation is shown (AC-F006-01).')}
${figure('ui/ui-15-doctor-schedule-after-reload-saturday.png', 'After a page reload the Saturday shifts are loaded again from PostgreSQL (AC-F006-01).')}
${figure('ui/ui-16-doctor-holiday-exception.png', 'A full-day holiday exception (31 December 2026) is added to the doctor’s schedule (AC-F006-03).')}
<h3>F-007 Administrator schedule governance and clinic settings</h3>
${figure(['ui/ui-17a-admin-doctor-schedules-top.png', 'ui/ui-17b-admin-doctor-schedules-saturday.png', 'ui/ui-17c-admin-doctor-schedules-holiday.png'], 'The administrator selects the doctor and sees the Saturday shifts and the holiday that the doctor saved earlier (AC-F007-03). Upper image: top of the page; middle image: the Saturday card; lower image: the holiday list.')}
${figure('ui/ui-18-admin-settings-saved.png', 'The administrator updates the clinic settings (start interval 30 minutes, cancellation cutoff 12 hours) and the change is saved (AC-F007-01).')}

<h2>F.7 API demonstration</h2>
<p>The following requests were sent with <code>curl</code> to the running API. Cookie values are redacted; every other header and body is the raw response.
 The seed password is shown as a placeholder.</p>
${figure('terminal/term-07-api-auth-session.png', 'Sign-in sets HttpOnly, SameSite=Strict cookies; <code>/auth/me</code> returns the role; sign-out revokes the session and the next request is refused with 401 (STS-S1-001).')}
${figure('terminal/term-08-api-rejections.png', 'Rejected requests: inactive account (403 ACCOUNT_INACTIVE), wrong password (401), a patient calling an administrator endpoint (403 FORBIDDEN), overlapping shifts (422 INVALID_SCHEDULE_WINDOW) and a duplicate doctor–service assignment (409 DUPLICATE_ASSIGNMENT).')}

<h2>F.8 Database evidence</h2>
<p>The output below is produced by <code>psql</code> against the same PostgreSQL ${esc(pgVersion)} database after the user-interface and API journeys.
 It shows the versioned migration, the Argon2id password hashes (truncated), the rows written through the user interface, the database CHECK constraints
 on schedule windows and the audit entry written for the settings change.</p>
${figure('terminal/term-09-db-accounts-shifts.png', 'Seeded accounts with Argon2id password hashes (F-001) and the split shifts saved by the doctor in <code>doctor_schedules</code> (F-006).')}
${figure('terminal/term-10-db-settings-audit.png', 'The clinic settings row and the <code>CLINIC_SETTINGS_UPDATED</code> audit entries with the administrator account and a UTC timestamp (F-007, AC-F007-01).')}

<h2>F.9 Code excerpts</h2>
${excerptBox(ex1, 'Overlap rule for doctor shifts: back-to-back shifts are allowed, any other overlap is rejected (F-006, AC-F006-02).')}
${excerptBox(ex2, 'Role guard of the RBAC pipeline: the request is refused with 401 or 403 unless the role is allowed (F-001, AC-F001-03).')}
${excerptBox(ex3, 'Session cookies are HttpOnly and SameSite=Strict; the Secure flag follows the environment (F-001, Definition of Done gate 4).')}
${excerptBox(ex4, 'Clinic settings update: only changed fields are written, and the change and its audit entry are stored in one database transaction (F-007, AC-F007-01).')}

<h2>F.10 Issues, pull requests and continuous integration</h2>
<p>Every feature was tracked by a GitHub Issue, implemented on its own branch and merged into <code>sprint-1-staging</code> by a pull request; the release pull request
 then merged <code>sprint-1-staging</code> into <code>main</code>, which was tagged <code>${esc(release.tag)}</code>. The tables below were read from the GitHub API on ${esc(bangkokDate(gh.generatedAt))}.</p>
${tcap('GitHub Issues of Sprint 1')}
<table class="md"><thead><tr><th class="nw">Issue</th><th>Title</th><th class="nw">State</th><th class="nw">Closed</th></tr></thead><tbody>${issueRows}</tbody></table>
${tcap('Merged pull requests and merge commits')}
<table class="md dense"><thead><tr><th class="nw">PR</th><th>Title</th><th>Branch</th><th class="nw">Merged</th><th class="nw">Merge commit</th></tr></thead><tbody>${prRows}</tbody></table>
<p>The release pull request #${releasePr.number} merged <code>sprint-1-staging</code> into <code>main</code>; its merge commit <code>${release.shortCommit}</code> carries the tag <code>${esc(release.tag)}</code>.
 Pull requests merged after the release pull request only change documentation (this report, its figures and specification text), with no code changes; the tag stays on commit <code>${release.shortCommit}</code>.</p>
${tcap('Runs of the GitHub Actions workflow “CI & Docker Build” on pull requests')}
<table class="md dense"><thead><tr><th class="nw">Run</th><th class="nw">PR</th><th>Branch</th><th class="nw">Commit</th><th class="nw">Result</th><th class="num nw">Duration</th></tr></thead><tbody>${ciRows}</tbody></table>
<p>The workflow runs the backend tests against a PostgreSQL 16 service, the frontend tests and build, and the production Docker build. A failed run was followed by a
 corrective commit on the same branch; the last run of every pull request that was checked succeeded. On the release pull request the first run failed in the Docker build
 (the client lockfile lacked the Playwright packages and the client type check needed the Node.js type definitions when installed in isolation); pull request #${gh.prs.find((p) => p.head === 'fix/9-client-lockfile-docker').number} fixed both and the run on the final commit passed.</p>
${figure('github/gh-01-merged-pull-requests.png', 'Merged pull requests of the repository on GitHub, including the release pull request.')}
${figure('github/gh-02-issues.png', 'GitHub Issues of Sprint 1 (Issue #9 is the integration and release issue).')}
${figure('github/gh-03-ci-run-release-pr.png', 'Successful “CI &amp; Docker Build” run on the final commit of the release pull request.')}
${figure('github/gh-04-release-tag.png', `The release tag <code>${esc(release.tag)}</code> on commit <code>${release.shortCommit}</code> of <code>main</code>.`)}

<h2>F.11 Known limitations and disclosures</h2>
<ul>
<li><strong>Sprint 1 scope.</strong> As recorded in change CHG-001 and DEC-017 (Part B), patient self-registration, password change and recovery, and patient account suspension are deferred to Sprint 2.
 Sprint 1 uses seeded demonstration accounts.</li>
<li><strong>Appointment screens.</strong> Booking, rescheduling and cancellation belong to Sprint 2. The menu entries “My Appointments” exist as honest placeholders;
 the navigation tests check that they do not pretend to work.</li>
<li><strong>End-to-end tests.</strong> The three Playwright journeys (${t.e2e.tests} tests) run in Chromium only and are run locally; the CI workflow has no browsers installed. They need a disposable database whose name ends in <code>_test</code>.</li>
<li><strong>Continuous integration.</strong> The CI workflow is triggered by pull requests to <code>main</code>. Changes merged into <code>sprint-1-staging</code> were verified locally
 (lint, build and the test tiers of Table F.2) and again by the CI run of the release pull request.</li>
<li><strong>Regression demonstration.</strong> The fail-before/pass-after record in section F.4 was produced at release time by breaking and restoring the overlap rule; it is not a recording of the original development sequence.</li>
<li><strong>Demonstration data.</strong> The seed accounts share one development password documented in the README. It must be changed, and secrets must come from the environment, in any deployed system (Lab 5).</li>
<li><strong>Cloud deployment.</strong> Docker packaging is prepared and its build is part of CI; deployment to Google Cloud and the related pipeline are verified in Lab 5, not in this deliverable.</li>
</ul>
`;
}

// --- fonts (IBM Plex, installed as npm packages so the PDF does not depend on the machine's fonts) --------------------
function fontCss() {
  const sources = [
    ...[400, 500, 600, 700].map((w) => ['@fontsource/ibm-plex-sans-thai', `${w}.css`]),
    ...[400, 600].map((w) => ['@fontsource/ibm-plex-mono', `${w}.css`]),
  ];
  return sources
    .map(([pkg, file]) => {
      const dir = join(here, 'node_modules', pkg);
      const base = pathToFileURL(join(dir, 'files')).href;
      return readFileSync(join(dir, file), 'utf8').replaceAll('url(./files/', `url(${base}/`);
    })
    .join('\n');
}

// --- assemble the document ---------------------------------------------------------------------------------------
const MEMBERS = [
  { no: 1, name: 'กมนนัทธ์ สีทาไข', id: '67070501001' },
  { no: 2, name: 'เบญญาภา รัตนคุโณดม', id: '67070501030' },
];

function buildHtml(pages) {
  const css = fontCss() + '\n' + readFileSync(join(here, 'style.css'), 'utf8');
  const bodies = PARTS.map((p) => {
    const { html } = p.file ? partFromMarkdown(p) : { html: partF() };
    const source = p.file ? `Source: ${p.file}` : 'Source: project test runs, running system, repository history and GitHub';
    return `<section class="part" id="part-${p.id}" data-seg="${p.id}">
<h1 class="part-title">Part ${p.letter}: ${esc(p.title)}</h1>
<div class="part-source">${esc(source)}</div>
${html}</section>`;
  });

  const navRows = PARTS.map((p) => {
    const sub = p.file ? p.file : 'Release summary, setup, test results, traceability, UI/API/database evidence, code excerpts, issues, pull requests and CI';
    return `<tr><td class="part">Part ${p.letter}</td><td><a href="#part-${p.id}">${esc(p.title)}<small${p.file ? '' : ' class="plain"'}>${esc(sub)}</small></a></td><td class="pg">${pages ? pages[p.id] : '–'}</td></tr>`;
  }).join('');

  const memberRows = MEMBERS.map((m) => `<tr><td>${m.no}</td><td>${m.name}</td><td>${m.id}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Appointly — CPE 334 Project Deliverable 1</title>
<style>${css}</style></head><body>
<section class="cover" data-seg="cover">
  <div class="course">CPE 334 Software Engineering</div>
  <h1>Appointly</h1>
  <div class="subtitle">Clinic Appointment &amp; Scheduling Management System</div>
  <div class="subtitle-th">ระบบจัดการนัดหมายและตารางเวลาคลินิก</div>
  <div class="deliverable">Project Deliverable 1</div>
  <div class="details">
    <p class="caption-line">Project team</p>
    <table><thead><tr><th style="width:12mm">No.</th><th>Name</th><th style="width:34mm">Student ID</th></tr></thead><tbody>${memberRows}</tbody></table>
  </div>
</section>
<section class="nav" data-seg="nav">
  <h1>Table of Contents</h1>
  <table><thead><tr><th>Part</th><th>Title</th><th class="pg">Page</th></tr></thead><tbody>${navRows}</tbody></table>
</section>
${bodies.join('\n')}
</body></html>`;
}

// --- print -------------------------------------------------------------------------------------------------------------------
const pageCount = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page(?![\w])/g) || []).length;

async function load(page) {
  await page.goto(pathToFileURL(OUT_HTML).href);
  await page.emulateMedia({ media: 'print' });
  // load every declared font face and image up front, so no print measures text or layout before they are ready
  await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  });
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
  if (broken.length) throw new Error(`images failed to load: ${broken.join(', ')}`);
}

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    // pass 1: measure. Every part starts on a new page, so the pages used by "cover .. part X" (the prefix of the
    // real document) tell where part X+1 begins; prefixes paginate exactly like the full document.
    writeFileSync(OUT_HTML, buildHtml(null));
    await load(page);
    const segs = ['cover', 'nav', ...PARTS.map((p) => p.id)];
    const upTo = {};
    for (let k = 0; k < segs.length; k += 1) {
      const shown = new Set(segs.slice(0, k + 1));
      await page.evaluate((keep) => document.querySelectorAll('[data-seg]').forEach((e) => (e.style.display = keep.includes(e.dataset.seg) ? '' : 'none')), [...shown]);
      await page.evaluate(() => document.fonts.ready);
      upTo[segs[k]] = pageCount(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
    }
    const counts = {};
    const pages = {};
    segs.forEach((seg, k) => {
      pages[seg] = k === 0 ? 1 : upTo[segs[k - 1]] + 1;
      counts[seg] = upTo[seg] - (k === 0 ? 0 : upTo[segs[k - 1]]);
    });
    const totalPages = upTo[segs[segs.length - 1]];
    if (counts.cover !== 1 || counts.nav !== 1) warnings.push(`cover=${counts.cover} nav=${counts.nav} pages (expected 1 each)`);

    // pass 2: real document with measured page numbers
    writeFileSync(OUT_HTML, buildHtml(pages));
    await load(page);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, outline: true, tagged: true });
    writeFileSync(OUT_PDF, pdf);

    const measured = pageCount(pdf);
    console.log('pages per segment:', JSON.stringify(counts));
    console.log('start pages      :', JSON.stringify(pages));
    console.log(`total pages: ${measured} (expected ${totalPages})${measured === totalPages ? '' : '  <-- MISMATCH'}`);
    if (measured !== totalPages) warnings.push('page-number measurement does not match the final page count');
  } finally {
    await browser.close();
  }
  for (const w of warnings) console.warn('WARNING:', w);
  console.log('written:', OUT_PDF);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
