// ==============================================================================
// Appointly — ESLint configuration (flat config, ESLint 9)
// ==============================================================================
// Reference: Sprint 1 Contracts Section 4.1 (DoD item 2: "pass linting with zero errors")
// One config for the whole monorepo:
//   server/   Node + Express + Prisma (CommonJS output)
//   client/   React 18 + Vite (browser, ES modules)
//   tests     relaxed (any / non-null assertions are normal when probing an API)
// `npm run lint` runs ESLint and then the strict type-check (unused code) in each package.
// ==============================================================================

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'client/test-results/**',
      'client/playwright-report/**',
      'server/prisma/migrations/**',
      'reports/**',
      'deploy/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // Unused code is already an error in `tsc` (noUnusedLocals/Parameters); allow the `_x` convention here too.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // ---- server -------------------------------------------------------------
  {
    files: ['server/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // The process entry point and the seed script are CLIs: console output is their interface.
    files: [
      'server/src/server.ts',
      'server/prisma/seed.ts',
      'server/prisma/seed-runner.ts',
      'server/src/shared/utils/logger.ts',
    ],
    rules: { 'no-console': 'off' },
  },

  // ---- client -------------------------------------------------------------
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // Build tooling and the Playwright runner run in Node.
    files: ['client/*.{ts,js,cjs,mjs}', 'client/tests/sprint-1/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // ---- tests (both packages) ----------------------------------------------
  {
    files: ['**/tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // ---- plain scripts ------------------------------------------------------
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
