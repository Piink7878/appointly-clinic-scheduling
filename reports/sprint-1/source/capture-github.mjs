// ==============================================================================
// Appointly - Deliverable 1 GitHub evidence screenshots
// ==============================================================================
// Screenshots of public GitHub pages (no sign-in) of the project repository:
// merged pull requests, issues, the CI workflow run of the release pull request and the release tag.
//
//   node capture-github.mjs
// Output: ../figures/github/*.png
// ==============================================================================

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const OUT = resolve(here, '../figures/github');
mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(join(repo, 'package.json'))('playwright-core');

const gh = JSON.parse(readFileSync(join(here, 'evidence/github.json'), 'utf8'));
const base = gh.repoUrl;
// the successful CI run of the release pull request (the pull request whose merge commit carries the tag)
const releasePr = gh.prs.find((p) => p.mergeCommit === gh.release.commit);
const release = gh.ciRuns.find((r) => r.conclusion === 'success' && r.pr === releasePr.number);

const pages = [
  { file: 'gh-01-merged-pull-requests.png', url: `${base}/pulls?q=is%3Apr+is%3Amerged`, wait: '[data-testid="list-view-items"], .js-issue-row', height: 1420 },
  { file: 'gh-02-issues.png', url: `${base}/issues?q=is%3Aissue`, wait: '[data-testid="list-view-items"], .js-issue-row', height: 1000 },
  { file: 'gh-03-ci-run-release-pr.png', url: release.url, wait: 'text=test-and-docker', height: 900 },
  { file: 'gh-04-release-tag.png', url: `${base}/releases/tag/${gh.release.tag}`, wait: 'text=' + gh.release.tag, height: 700 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5, locale: 'en-US' });
  for (const p of pages) {
    await page.goto(p.url, { waitUntil: 'domcontentloaded' });
    await page.locator(p.wait).first().waitFor({ timeout: 30_000 }).catch(() => console.warn('  (selector not seen, capturing anyway)', p.file));
    await page.waitForTimeout(1500);
    // hide cookie / sign-in banners so only the repository content is shown
    await page.addStyleTag({ content: '.js-notice, [data-testid="cookie-banner"], .Header-old + .flash, .logged-out-banner { display: none !important; }' });
    await page.screenshot({ path: join(OUT, p.file), fullPage: true, clip: { x: 0, y: 0, width: 1280, height: p.height } });
    console.log('saved', p.file, '←', p.url);
  }
} finally {
  await browser.close();
}
