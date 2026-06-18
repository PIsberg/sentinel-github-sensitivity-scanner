import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Unit tests live next to the code they cover. The Playwright e2e suite in
    // ./e2e is driven by `npm test` and must not be picked up by Vitest.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
