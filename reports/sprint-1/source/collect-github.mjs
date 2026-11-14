// ==============================================================================
// Appointly - Deliverable 1 GitHub history collector
// ==============================================================================
// Reads the public GitHub REST API (no token needed for a public repository) and writes
// evidence/github.json: issues, pull requests with their merge commits, CI runs and the release tag.
//
//   node collect-github.mjs [owner/repo]        (default: the "origin" remote of this repository)
// ==============================================================================

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(here, '../../..');
const origin = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repoDir, encoding: 'utf8' }).trim();
const slug = process.argv[2] || origin.replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '');
const TAG = 'v0.1.0-sprint1';

const api = async (path) => {
  const res = await fetch(`https://api.github.com/repos/${slug}${path}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'deliverable-report' } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
};

// dates are shown in the clinic time zone (Asia/Bangkok, UTC+7), like the rest of the report
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : null);

const issues = [];
for (let n = 1; n <= 9; n += 1) {
  const i = await api(`/issues/${n}`);
  issues.push({ number: i.number, title: i.title.replace(/^Issue #\d+:\s*/, ''), state: i.state, closed: day(i.closed_at), labels: i.labels.map((l) => l.name), url: i.html_url });
}

const prs = [];
for (let n = 10; n <= 40; n += 1) {
  let p;
  try {
    p = await api(`/pulls/${n}`);
  } catch {
    break; // no more pull requests
  }
  prs.push({
    number: p.number,
    title: p.title,
    head: p.head.ref,
    base: p.base.ref,
    merged: day(p.merged_at),
    mergeCommit: p.merge_commit_sha,
    files: p.changed_files,
    additions: p.additions,
    deletions: p.deletions,
    url: p.html_url,
  });
}

const runs = (await api('/actions/workflows/ci-docker.yml/runs?per_page=50')).workflow_runs.map((r) => ({
  id: r.id,
  event: r.event,
  branch: r.head_branch,
  sha: r.head_sha.slice(0, 7),
  conclusion: r.conclusion,
  status: r.status,
  started: r.run_started_at,
  finished: r.updated_at,
  url: r.html_url,
}));

const ref = await api(`/git/ref/tags/${TAG}`);
const tagObj = ref.object.type === 'tag' ? await api(`/git/tags/${ref.object.sha}`) : null;
const commitSha = tagObj ? tagObj.object.sha : ref.object.sha;
const commit = await api(`/commits/${commitSha}`);

const out = {
  generatedAt: new Date().toISOString(),
  repo: slug,
  repoUrl: `https://github.com/${slug}`,
  issues,
  prs,
  ciRuns: runs,
  release: { tag: TAG, commit: commitSha, shortCommit: commitSha.slice(0, 7), date: day(commit.commit.committer.date), message: commit.commit.message.split('\n')[0] },
};
writeFileSync(join(here, 'evidence/github.json'), JSON.stringify(out, null, 2));
console.log(`github.json: ${issues.length} issues, ${prs.length} pull requests, ${runs.length} CI runs, tag ${TAG} -> ${out.release.shortCommit}`);
