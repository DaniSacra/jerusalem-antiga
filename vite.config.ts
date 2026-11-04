import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  // The seeded map, survival, tutorial and viability tests play many games: more time than the default 5 s.
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 },
});
