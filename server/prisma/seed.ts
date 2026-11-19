// ==============================================================================
// Appointly — Database Seed Script (entry point: `npm run prisma:seed`)
// ==============================================================================
// Resolves the seed policy from the environment and runs it. The logic lives in
// seed-runner.ts; passwords, demo gating and overwrite rules in seed-config.ts.
// ==============================================================================

import { PrismaClient } from '@prisma/client';
import { resolveSeedConfig } from './seed-config';
import { runSeed } from './seed-runner';

const prisma = new PrismaClient();

async function main() {
  const config = resolveSeedConfig(process.env);
  await runSeed(prisma, config);
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
