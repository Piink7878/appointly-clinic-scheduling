/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Playwright specs (tests/sprint-1/e2e/) have their own runner: `npm run test:e2e`.
    exclude: ['tests/sprint-1/e2e/**', 'node_modules/**', 'dist/**'],
  },
});

