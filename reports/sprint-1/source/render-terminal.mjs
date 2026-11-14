// ==============================================================================
// Appointly - Deliverable 1 terminal-figure renderer
// ==============================================================================
// Turns excerpts of the saved logs (../figures/logs/*.log) into PNG "terminal screenshots"
// (../figures/terminal/*.png). The text is taken from the log files unchanged; only the selection
// of lines (and, for the E2E list, the removal of the repeated spec-file prefix) is done here.
//
//   node render-terminal.mjs
// ==============================================================================

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const LOGS = resolve(here, '../figures/logs');
const OUT = resolve(here, '../figures/terminal');
mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(join(repo, 'package.json'))('playwright-core');

const read = (f) => readFileSync(join(LOGS, f), 'utf8').replace(/\r/g, '');
// eslint-disable-next-line no-control-regex
const clean = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
const lines = (f) => clean(read(f)).split('\n');
const nonBlank = (arr) => arr.filter((l) => l.trim() !== '');

/** Sections of a log that start with a line matching `marker` (blank line or next marker ends a section). */
function sections(f, marker) {
  const out = [];
  let cur = null;
  for (const l of lines(f)) {
    if (marker.test(l)) {
      cur = [l];
      out.push(cur);
    } else if (/^### /.test(l)) {
      cur = null; // the next request starts: the previous section is complete
    } else if (cur) cur.push(l);
  }
  return out.map((s) => nonBlank(s));
}

const fontDir = pathToFileURL(join(here, 'node_modules/@fontsource/ibm-plex-mono/files')).href;

const spec = [
  {
    file: 'term-01-setup-migrate-seed.png',
    text: nonBlank(lines('02-prisma-migrate-seed.log')).filter((l) => !/Running generate|Prisma Client|Tip:/.test(l)),
  },
  {
    file: 'term-02-typecheck-lint-build.png',
    text: nonBlank([
      ...lines('03-typecheck.log'),
      ...lines('04-lint.log'),
      ...lines('05-build.log').filter((l) => !/^\s*$/.test(l)),
    ]),
  },
  {
    file: 'term-03-server-tests.png',
    text: nonBlank(lines('06-server-tests.log')).filter((l) => /^\$|^ [✓×❯] tests\/|Test Files|Tests  |Duration|exit=/.test(l)),
  },
  {
    file: 'term-04-client-tests.png',
    text: nonBlank(lines('07-client-tests.log')).filter((l) => /^\$|^ [✓×❯] tests\/|Test Files|Tests  |Duration|exit=/.test(l)),
  },
  {
    file: 'term-05-e2e-tests.png',
    text: nonBlank(lines('08-e2e-tests.log'))
      .filter((l) => !/^\s*$/.test(l))
      .map((l) => l.replace(/\[chromium\] › tests\\sprint-1\\e2e\\sprint-1\.spec\.ts:\d+:\d+ › /, '').replace(/ \(F-0[^)]*\)/, '')),
  },
  {
    file: 'term-06-tdd-red-green.png',
    text: [
      ...nonBlank(lines('09-tdd-red-overlap-broken.log')).filter((l) => !/^ FAIL|AssertionError|Failed Tests/.test(l)),
      '',
      ...nonBlank(lines('10-tdd-green-overlap-restored.log')),
    ],
  },
  {
    file: 'term-07-api-auth-session.png',
    text: sections('11-api-evidence.log', /^### STS-S1-001/).slice(0, 4).flatMap((s) => [...s, '']),
  },
  {
    file: 'term-08-api-rejections.png',
    text: [
      /^### STS-S1-001 {2}INACTIVE/,
      /^### STS-S1-002 {2}Wrong password/,
      /^### STS-S1-003 {2}PATIENT -> GET/,
      /^### STS-S1-008 {2}Overlapping/,
      /^### STS-S1-007/,
    ].flatMap((m) => [...sections('11-api-evidence.log', m)[0], '']),
  },
  {
    file: 'term-09-db-accounts-shifts.png',
    text: ['-- F-001', '-- F-006: split'].flatMap((t) => {
      const all = clean(read('12-db-evidence.log')).split(/\n(?=-- )/);
      const block = all.find((b) => b.startsWith(t));
      return [...nonBlank(block.split('\n')), ''];
    }),
  },
  {
    file: 'term-10-db-settings-audit.png',
    text: ['-- F-007: clinic', '-- F-007: the settings'].flatMap((t) => {
      const all = clean(read('12-db-evidence.log')).split(/\n(?=-- )/);
      const block = all.find((b) => b.startsWith(t));
      return [...nonBlank(block.split('\n')), ''];
    }),
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = (text) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Plex Mono';font-weight:400;src:url(${fontDir}/ibm-plex-mono-latin-400-normal.woff2)}
@font-face{font-family:'Plex Mono';font-weight:600;src:url(${fontDir}/ibm-plex-mono-latin-600-normal.woff2)}
html,body{margin:0;background:#fff}
#t{display:inline-block;box-sizing:border-box;width:1180px;padding:14px 18px;background:#f4f4f4;border:1px solid #bdbdbd;
   font:400 14.5px/1.45 'Plex Mono',monospace;color:#1b1b1b;white-space:pre-wrap;overflow-wrap:anywhere}
.cmd{font-weight:600}
</style><div id="t">${text
  .map((l) => (/^\$ |^appointly_test=> |^### |^-- /.test(l) ? `<span class="cmd">${esc(l)}</span>` : esc(l)))
  .join('\n')}</div>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1.6 });
  for (const s of spec) {
    if (!s.text.length) throw new Error(`no text selected for ${s.file}`);
    await page.setContent(html(s.text));
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#t').screenshot({ path: join(OUT, s.file) });
    console.log('rendered', s.file, `(${s.text.length} lines)`);
  }
  writeFileSync(join(OUT, 'README.txt'), 'Excerpts of ../logs/*.log rendered as images; the complete logs are kept next to this folder.\n');
} finally {
  await browser.close();
}
