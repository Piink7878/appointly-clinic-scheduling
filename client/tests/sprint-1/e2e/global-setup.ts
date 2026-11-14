// ==============================================================================
// Appointly Client — E2E Global Setup
// ==============================================================================
// Fails fast, with a clear message, when the environment cannot run the journeys.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default function globalSetup(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distIndex = path.resolve(here, '../../../dist/index.html');

  // The API serves client/dist, so the journeys exercise the production bundle.
  if (!fs.existsSync(distIndex)) {
    throw new Error(
      'client/dist is missing. Build the client first: `npm run build` (or just use `npm run test:e2e`, which builds).'
    );
  }
}
