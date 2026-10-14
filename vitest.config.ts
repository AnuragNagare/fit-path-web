import { defineConfig } from 'vitest/config';

// Fast unit tests only. The database tests run with `npm run test:db` (see vitest.db.config.ts).
export default defineConfig({
  test: { include: ['api/**/*.test.ts'], exclude: ['**/*.db.test.ts', '**/node_modules/**'] },
});
