# Deliverable 1 report — sources

Builds `../Appointly-Deliverable-1.pdf` (Parts A–E from `specs/`, Part F from the evidence collected here).
The PDF is printed by the Chromium that ships with Playwright; no LaTeX installation is needed.

```bash
cd reports/sprint-1/source
npm install                                   # once: marked, highlight.js, IBM Plex fonts

# 1. Test results and AC/STS traceability (reports from the three test tiers, see the README of the repository)
node collect-evidence.mjs <server-vitest.json> <client-vitest.json> <playwright.json>
# 2. Issues, pull requests, CI runs and the release tag (public GitHub API)
node collect-github.mjs
# 3. Build the PDF (writes ../Appointly-Deliverable-1.pdf)
node build.mjs
```

Evidence that needs a running system (PostgreSQL 16, API on port 4100 serving the client build):

| Script | Output (in `../figures/`) |
| --- | --- |
| `capture-screenshots.mjs` | `ui/` — screenshots of the real UI as the seeded users |
| `api-evidence.sh` | `logs/11-api-evidence.log` — real `curl` calls |
| `db-evidence.mjs` | `logs/12-db-evidence.log` — `psql` output |
| `render-terminal.mjs` | `terminal/` — log excerpts rendered as images |
| `capture-github.mjs` | `github/` — screenshots of the public repository pages |

`figures/logs/` also holds the complete logs of the static checks, builds and test runs, and
`figures/code/` the plain-text copies of the code excerpts used in Part F.
